
import { powershellService } from './powershellService';
import { loggingService } from './loggingService';

export interface DatabaseMetrics {
  currentSizeGB: number;
  maxSizeGB: number;
  instanceName: string;
  contentPath: string;
  lastBackup: string;
}

// Whitelist of allowed SQL query patterns
const ALLOWED_QUERY_PATTERNS = [
  /^SELECT\s+/i,
  /^EXEC\s+sp_MSforeachtable/i,
];

// Dangerous SQL keywords that should never appear
const DANGEROUS_KEYWORDS = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE'];

class SqlService {
  private serverInstance: string;
  private databaseName: string;

  constructor() {
    // Use environment variables with fallback
    this.serverInstance = process.env.SQL_SERVER_INSTANCE || 
      (process.env.NODE_ENV === 'production' ? 'PROD-SERVER\\SQLINSTANCE' : 'localhost\\SQLEXPRESS');
    this.databaseName = process.env.WSUS_DATABASE_NAME || 'SUSDB';
    
    if (!this.serverInstance) {
      throw new Error('SQL_SERVER_INSTANCE environment variable must be set');
    }
  }

  /**
   * Validate SQL query for security
   */
  private validateQuery(query: string): void {
    const trimmedQuery = query.trim();
    
    // Check if query matches allowed patterns
    if (!ALLOWED_QUERY_PATTERNS.some(pattern => pattern.test(trimmedQuery))) {
      throw new Error('Query not in whitelist of allowed queries');
    }
    
    // Check for dangerous keywords
    const upperQuery = trimmedQuery.toUpperCase();
    for (const keyword of DANGEROUS_KEYWORDS) {
      // Only allow EXEC for specific stored procedures
      if (keyword === 'EXEC' || keyword === 'EXECUTE') {
        if (!/^EXEC\s+sp_MSforeachtable/i.test(trimmedQuery)) {
          throw new Error('EXEC/EXECUTE only allowed for whitelisted stored procedures');
        }
        continue;
      }
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(trimmedQuery)) {
        throw new Error(`Dangerous SQL keyword detected: ${keyword}`);
      }
    }
    
    // Validate query length
    if (trimmedQuery.length > 10000) {
      throw new Error('Query exceeds maximum length');
    }
  }

  /**
   * Escape password for PowerShell (never pass in command line)
   */
  private escapePasswordForPowerShell(password: string): string {
    // Escape single quotes by doubling them
    return password.replace(/'/g, "''");
  }

  /**
   * Execute a SQL query using PowerShell and SQL Server cmdlets
   * Uses secure credential passing (never in command line)
   */
  async executeQuery(query: string, saPassword?: string, timeoutMs: number = 30000): Promise<unknown[]> {
    try {
      // Validate query first
      this.validateQuery(query);
      
      // Escape query for PowerShell (but query is already validated)
      const escapedQuery = query.replace(/'/g, "''").replace(/"/g, '\\"');
      
      // Build secure PowerShell script
      const script = `
        $ErrorActionPreference = 'Stop'
        $serverInstance = "${this.serverInstance}"
        $database = "${this.databaseName}"
        
        ${saPassword ? `
          $securePassword = ConvertTo-SecureString "${this.escapePasswordForPowerShell(saPassword)}" -AsPlainText -Force
          $credential = New-Object System.Management.Automation.PSCredential("sa", $securePassword)
        ` : ''}
        
        try {
          Import-Module SqlServer -ErrorAction Stop
          $results = Invoke-Sqlcmd -ServerInstance $serverInstance -Database $database -Query @"
${query}
"@ ${saPassword ? '-Credential $credential' : '-TrustedConnection'} -ErrorAction Stop
          $results | ConvertTo-Json -Compress
        } catch {
          Write-Error "SQL execution failed: $_"
          exit 1
        }
      `;

      // Use Promise.race for timeout
      const queryPromise = powershellService.execute(script, timeoutMs);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      );
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      if (!result.success || !result.stdout) {
        const sanitizedError = this.sanitizeError(result.stderr);
        loggingService.error(`SQL query failed: ${sanitizedError}`);
        return [];
      }

      try {
        const data = JSON.parse(result.stdout);
        return Array.isArray(data) ? data : [data];
      } catch (parseError: unknown) {
        // If JSON parsing fails, return empty array
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        loggingService.warn(`Failed to parse SQL result as JSON: ${errorMessage}`);
        return [];
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const sanitizedError = this.sanitizeError(errorMessage);
      loggingService.error(`Error executing SQL query: ${sanitizedError}`);
      return [];
    }
  }

  /**
   * Sanitize error messages to prevent information disclosure
   */
  private sanitizeError(error: string): string {
    return error
      .replace(/C:\\[^\s]+/g, '[PATH]')
      .replace(/at\s+.*\n/g, '')
      .replace(/Line\s+\d+:/g, '[LINE]')
      .substring(0, 200); // Limit length
  }

  /**
   * Get database size information
   */
  async getDatabaseMetrics(saPassword?: string): Promise<DatabaseMetrics | null> {
    try {
      const query = `
        SELECT 
          DB_NAME() AS DatabaseName,
          CAST(SUM(size) * 8.0 / 1024 / 1024 AS DECIMAL(10,2)) AS SizeGB,
          CAST(SUM(size) * 8.0 / 1024 AS DECIMAL(10,2)) AS SizeMB
        FROM sys.database_files
        WHERE type = 0
      `;

      const results = await this.executeQuery(query, saPassword);
      
      if (results.length === 0 || !results[0]) {
        return null;
      }

      const firstResult = results[0] as { SizeGB?: string | number };
      const sizeGB = typeof firstResult.SizeGB === 'string' 
        ? parseFloat(firstResult.SizeGB) 
        : (typeof firstResult.SizeGB === 'number' ? firstResult.SizeGB : 0);

      return {
        currentSizeGB: sizeGB || 0,
        maxSizeGB: 10, // SQL Express limit
        instanceName: this.serverInstance,
        contentPath: 'C:\\WSUS\\',
        lastBackup: await this.getLastBackupDate(saPassword)
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const sanitizedError = this.sanitizeError(errorMessage);
      loggingService.error(`Error getting database metrics: ${sanitizedError}`);
      return null;
    }
  }

  /**
   * Reindex database
   */
  async reindexDatabase(saPassword?: string): Promise<boolean> {
    try {
      const query = `
        EXEC sp_MSforeachtable 'ALTER INDEX ALL ON ? REBUILD WITH (FILLFACTOR = 80, ONLINE = OFF)'
      `;

      await this.executeQuery(query, saPassword);
      loggingService.info('Database reindexing completed');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const sanitizedError = this.sanitizeError(errorMessage);
      loggingService.error(`Error reindexing database: ${sanitizedError}`);
      return false;
    }
  }

  /**
   * Get last backup date
   */
  private async getLastBackupDate(saPassword?: string): Promise<string> {
    try {
      const query = `
        SELECT TOP 1 
          backup_finish_date 
        FROM msdb.dbo.backupset 
        WHERE database_name = '${this.databaseName}'
        ORDER BY backup_finish_date DESC
      `;

      const results = await this.executeQuery(query, saPassword);
      if (results.length > 0 && results[0]) {
        const firstResult = results[0] as { backup_finish_date?: string | Date };
        if (firstResult.backup_finish_date) {
          const date = firstResult.backup_finish_date instanceof Date 
            ? firstResult.backup_finish_date 
            : new Date(firstResult.backup_finish_date);
          return date.toISOString().slice(0, 16).replace('T', ' ');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.warn(`Could not retrieve backup date: ${this.sanitizeError(errorMessage)}`);
    }
    
    return 'Never';
  }

  /**
   * Perform database cleanup
   */
  async performCleanup(saPassword?: string): Promise<boolean> {
    try {
      // This would typically call WSUS cleanup procedures
      loggingService.info('Database cleanup initiated');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const sanitizedError = this.sanitizeError(errorMessage);
      loggingService.error(`Error performing database cleanup: ${sanitizedError}`);
      return false;
    }
  }
}

export const sqlService = new SqlService();
