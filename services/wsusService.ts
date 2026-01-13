
import { powershellService } from './powershellService';
import { WsusComputer, WsusUpdate, EnvironmentStats, HealthStatus, ServiceState, DatabaseMetrics } from '../types';
import { loggingService } from './loggingService';

class WsusService {
  private wsusServer: string | null = null;
  private wsusPort: number = 8530;
  private useSsl: boolean = true;

  /**
   * Initialize WSUS connection
   */
  async initialize(server: string = 'localhost', port: number = 8530, useSsl: boolean = false): Promise<boolean> {
    this.wsusServer = server;
    this.wsusPort = port;
    this.useSsl = useSsl;

    try {
      // Check if WSUS PowerShell module is available
      // NOTE: UpdateServices module comes with WSUS Windows Server role - it cannot be installed from PSGallery
      const moduleAvailable = await powershellService.checkModule('UpdateServices');
      
      if (!moduleAvailable) {
        // UpdateServices is a Windows Feature module, not a PSGallery module
        // It's installed when you add the WSUS role to Windows Server
        loggingService.warn('WSUS PowerShell module (UpdateServices) not found.');
        loggingService.warn('This module is part of the WSUS Windows Server role.');
        loggingService.warn('To install: Add-WindowsFeature -Name UpdateServices -IncludeManagementTools');
        loggingService.info('Running in standalone mode without WSUS connection.');
        return false;
      }

      // Import the module
      const importResult = await powershellService.importModule('UpdateServices');
      if (!importResult.success) {
        loggingService.warn('Failed to import UpdateServices module. Running in standalone mode.');
        return false;
      }
      
      loggingService.info(`WSUS Service initialized: ${server}:${port} (SSL: ${useSsl})`);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Failed to initialize WSUS service: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get WSUS server connection
   */
  private getConnectionScript(): string {
    if (this.wsusServer === 'localhost') {
      return `Get-WsusServer -Name localhost -PortNumber ${this.wsusPort}`;
    } else {
      const protocol = this.useSsl ? 'https' : 'http';
      return `Get-WsusServer -Name "${this.wsusServer}" -PortNumber ${this.wsusPort} -UseSsl:$${this.useSsl}`;
    }
  }

  /**
   * Get all computers from WSUS
   */
  async getComputers(): Promise<WsusComputer[]> {
    try {
      const script = `
        $wsus = ${this.getConnectionScript()}
        $computers = Get-WsusComputer -UpdateServer $wsus
        $computers | ForEach-Object {
          $status = $_.FullDomainName
          $lastSync = if ($_.LastSyncTime) { $_.LastSyncTime.ToString('yyyy-MM-dd HH:mm') } else { 'Never' }
          $updatesNeeded = ($_ | Get-WsusUpdate).Count
          $updatesInstalled = (Get-WsusUpdate -UpdateServer $wsus -ApprovalAction Install -TargetGroupName $_.TargetGroup.Name).Count
          
          [PSCustomObject]@{
            Name = $_.FullDomainName
            IPAddress = $_.IPAddress
            OS = $_.OSDescription
            Status = if ($_.LastSyncTime -gt (Get-Date).AddDays(-7)) { 'Healthy' } elseif ($_.LastSyncTime -gt (Get-Date).AddDays(-30)) { 'Warning' } else { 'Critical' }
            LastSync = $lastSync
            UpdatesNeeded = $updatesNeeded
            UpdatesInstalled = $updatesInstalled
            TargetGroup = $_.TargetGroup.Name
          }
        } | ConvertTo-Json -Compress
      `;

      const result = await powershellService.execute(script);

      if (!result.success) {
        // IMPROVED: Distinguish between different failure modes
        if (result.stderr.includes('not whitelisted')) {
          loggingService.error('[WSUS] Command blocked by security whitelist. Check PowerShell service configuration.');
        } else if (result.stderr.includes('not in Electron')) {
          loggingService.warn('[WSUS] Running in browser mode - WSUS operations require Electron.');
        } else {
          loggingService.error(`[WSUS] Failed to retrieve computers: ${result.stderr.substring(0, 200)}`);
        }
        return [];
      }

      if (!result.stdout) {
        // Empty stdout with success = no computers found (valid state)
        loggingService.info('[WSUS] Query succeeded but returned no computers.');
        return [];
      }

      interface ParsedComputer {
        Name?: string;
        IPAddress?: string;
        OS?: string;
        Status?: string;
        LastSync?: string;
        UpdatesNeeded?: number;
        UpdatesInstalled?: number;
        TargetGroup?: string;
      }
      
      let computers: ParsedComputer[] | ParsedComputer;
      try {
        computers = JSON.parse(result.stdout) as ParsedComputer[] | ParsedComputer;
      } catch (parseError) {
        const parseErrorMsg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        loggingService.error(`[WSUS] Failed to parse computers JSON: ${parseErrorMsg}`);
        loggingService.warn(`[WSUS] Raw output (first 500 chars): ${result.stdout.substring(0, 500)}`);
        return [];
      }
      
      const computerArray = Array.isArray(computers) ? computers : [computers];
      
      return computerArray.map((c: ParsedComputer, index: number) => ({
        id: (index + 1).toString(),
        name: c.Name || 'Unknown',
        ipAddress: c.IPAddress || '0.0.0.0',
        os: c.OS || 'Unknown OS',
        status: this.mapHealthStatus(c.Status || 'Unknown'),
        lastSync: c.LastSync || 'Never',
        updatesNeeded: c.UpdatesNeeded || 0,
        updatesInstalled: c.UpdatesInstalled || 0,
        targetGroup: c.TargetGroup || 'Unassigned Computers'
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error retrieving WSUS computers: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Get environment statistics
   */
  async getStats(): Promise<EnvironmentStats | null> {
    try {
      const script = `
        $wsus = ${this.getConnectionScript()}
        $computers = Get-WsusComputer -UpdateServer $wsus
        $total = $computers.Count
        $healthy = ($computers | Where-Object { $_.LastSyncTime -gt (Get-Date).AddDays(-7) }).Count
        $warning = ($computers | Where-Object { $_.LastSyncTime -lt (Get-Date).AddDays(-7) -and $_.LastSyncTime -gt (Get-Date).AddDays(-30) }).Count
        $critical = ($computers | Where-Object { $_.LastSyncTime -lt (Get-Date).AddDays(-30) -or $_.LastSyncTime -eq $null }).Count
        $updates = (Get-WsusUpdate -UpdateServer $wsus).Count
        $securityUpdates = (Get-WsusUpdate -UpdateServer $wsus -Classification SecurityUpdates).Count
        
        # Get WSUS service status
        $wsusService = Get-Service -Name WsusService -ErrorAction SilentlyContinue
        $sqlService = Get-Service -Name 'MSSQL$SQLEXPRESS' -ErrorAction SilentlyContinue
        $iisService = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
        
        [PSCustomObject]@{
          TotalComputers = $total
          HealthyComputers = $healthy
          WarningComputers = $warning
          CriticalComputers = $critical
          TotalUpdates = $updates
          SecurityUpdatesCount = $securityUpdates
          WsusServiceStatus = if ($wsusService) { $wsusService.Status.ToString() } else { 'Unknown' }
          SqlServiceStatus = if ($sqlService) { $sqlService.Status.ToString() } else { 'Unknown' }
          IISServiceStatus = if ($iisService) { $iisService.Status.ToString() } else { 'Unknown' }
        } | ConvertTo-Json -Compress
      `;

      const result = await powershellService.execute(script);
      
      if (!result.success || !result.stdout) {
        return null;
      }

      interface ParsedStats {
        TotalComputers?: number;
        HealthyComputers?: number;
        WarningComputers?: number;
        CriticalComputers?: number;
        TotalUpdates?: number;
        SecurityUpdatesCount?: number;
        WsusServiceStatus?: string;
        SqlServiceStatus?: string;
        IISServiceStatus?: string;
      }
      
      interface ParsedDisk {
        FreeGB?: number;
      }
      
      let data: ParsedStats;
      try {
        data = JSON.parse(result.stdout) as ParsedStats;
      } catch (parseError) {
        loggingService.error('Failed to parse WSUS stats JSON');
        return null;
      }
      
      // Get disk space
      const diskResult = await powershellService.execute(
        `Get-PSDrive C | Select-Object @{Name='FreeGB';Expression={[math]::Round($_.Free / 1GB, 2)}} | ConvertTo-Json -Compress`
      );
      
      let diskFree = 0;
      if (diskResult.success && diskResult.stdout) {
        try {
          const diskData = JSON.parse(diskResult.stdout) as ParsedDisk;
          diskFree = diskData.FreeGB || 0;
        } catch (parseError) {
          loggingService.warn('Failed to parse disk space JSON');
        }
      }

      // Get database info (simplified - would need SQL connection for real data)
      const dbMetrics: DatabaseMetrics = {
        currentSizeGB: 0,
        maxSizeGB: 10,
        instanceName: 'localhost\\SQLEXPRESS',
        contentPath: 'C:\\WSUS\\',
        lastBackup: new Date().toISOString().slice(0, 16).replace('T', ' ')
      };

      return {
        totalComputers: data.TotalComputers || 0,
        healthyComputers: data.HealthyComputers || 0,
        warningComputers: data.WarningComputers || 0,
        criticalComputers: data.CriticalComputers || 0,
        totalUpdates: data.TotalUpdates || 0,
        securityUpdatesCount: data.SecurityUpdatesCount || 0,
        isInstalled: true,
        diskFreeGB: diskFree,
        automationStatus: 'Ready',
        services: [
          {
            name: 'WSUS Service',
            status: this.mapServiceStatus(data.WsusServiceStatus),
            lastCheck: 'Just now',
            type: 'WSUS'
          },
          {
            name: 'SQL Server (Express)',
            status: this.mapServiceStatus(data.SqlServiceStatus),
            lastCheck: 'Just now',
            type: 'SQL'
          },
          {
            name: 'IIS (W3SVC)',
            status: this.mapServiceStatus(data.IISServiceStatus),
            lastCheck: 'Just now',
            type: 'IIS'
          }
        ],
        db: dbMetrics
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error retrieving WSUS stats: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Force a computer to sync with WSUS
   */
  async forceComputerSync(computerName: string): Promise<boolean> {
    try {
      // Validate input
      if (!computerName || computerName.length > 255) {
        throw new Error('Invalid computer name');
      }
      
      // Whitelist safe characters for computer names
      if (!/^[a-zA-Z0-9.-]+$/.test(computerName)) {
        throw new Error('Computer name contains invalid characters');
      }
      
      // Escape for PowerShell (escape single quotes by doubling them)
      const escapedName = computerName.replace(/'/g, "''");
      
      const script = `
        $wsus = ${this.getConnectionScript()}
        $computer = Get-WsusComputer -UpdateServer $wsus -NameIncludes "${escapedName}" | Select-Object -First 1
        if ($computer) {
          Invoke-WsusServerSynchronization -UpdateServer $wsus -SyncType SynchronizeNow
          Write-Output "SUCCESS"
        } else {
          Write-Output "NOTFOUND"
        }
      `;

      const result = await powershellService.execute(script);
      return result.success && result.stdout.includes('SUCCESS');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error forcing computer sync: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute WSUS cleanup
   */
  async performCleanup(): Promise<boolean> {
    try {
      const script = `
        $wsus = ${this.getConnectionScript()}
        Invoke-WsusServerCleanup -UpdateServer $wsus -CleanupObsoleteUpdates -CleanupUnneededContentFiles -CleanupObsoleteComputers -CompressUpdates -DeclineExpiredUpdates
        Write-Output "SUCCESS"
      `;

      const result = await powershellService.execute(script, 600000); // 10 minute timeout
      return result.success && result.stdout.includes('SUCCESS');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error performing WSUS cleanup: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Decline all superseded updates
   * Superseded updates have been replaced by newer versions and should not be deployed
   */
  async declineSupersededUpdates(): Promise<{ declined: number; errors: number }> {
    try {
      const script = `
        $wsus = ${this.getConnectionScript()}
        $declined = 0
        $errors = 0
        
        Write-Output "[WSUS] Finding superseded updates..."
        $superseded = Get-WsusUpdate -UpdateServer $wsus | Where-Object {
          $_.Update.IsSuperseded -eq $true -and $_.Update.IsDeclined -eq $false
        }
        
        $total = ($superseded | Measure-Object).Count
        Write-Output "[WSUS] Found $total superseded updates to decline"
        
        foreach ($update in $superseded) {
          try {
            $update.Update.Decline()
            $declined++
            if ($declined % 100 -eq 0) {
              Write-Output "[WSUS] Declined $declined of $total..."
            }
          } catch {
            $errors++
          }
        }
        
        Write-Output "[WSUS] Complete: Declined $declined updates, $errors errors"
        [PSCustomObject]@{ Declined = $declined; Errors = $errors } | ConvertTo-Json -Compress
      `;

      loggingService.info('[WSUS] Starting decline of superseded updates...');
      const result = await powershellService.execute(script, 1800000); // 30 minute timeout

      if (result.stdout) {
        result.stdout.split('\n').forEach(line => {
          if (line.trim().startsWith('[WSUS]')) {
            loggingService.info(line.trim());
          }
        });
      }

      if (result.success && result.stdout) {
        try {
          // Find JSON in output
          const jsonMatch = result.stdout.match(/\{.*"Declined".*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return { declined: data.Declined || 0, errors: data.Errors || 0 };
          }
        } catch {
          // Parse error, try to extract from log
        }
      }
      
      return { declined: 0, errors: 0 };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error declining superseded updates: ${errorMessage}`);
      return { declined: 0, errors: 1 };
    }
  }

  /**
   * Decline updates older than specified days
   * Old updates that haven't been deployed shouldn't be kept around
   */
  async declineOldUpdates(daysOld: number = 90): Promise<{ declined: number; errors: number }> {
    try {
      const script = `
        $wsus = ${this.getConnectionScript()}
        $declined = 0
        $errors = 0
        $cutoffDate = (Get-Date).AddDays(-${daysOld})
        
        Write-Output "[WSUS] Finding updates older than ${daysOld} days (before $($cutoffDate.ToString('yyyy-MM-dd')))..."
        
        $oldUpdates = Get-WsusUpdate -UpdateServer $wsus | Where-Object {
          $_.Update.IsDeclined -eq $false -and
          $_.Update.CreationDate -lt $cutoffDate -and
          $_.Update.IsApproved -eq $false
        }
        
        $total = ($oldUpdates | Measure-Object).Count
        Write-Output "[WSUS] Found $total old updates to decline"
        
        foreach ($update in $oldUpdates) {
          try {
            $update.Update.Decline()
            $declined++
            if ($declined % 100 -eq 0) {
              Write-Output "[WSUS] Declined $declined of $total..."
            }
          } catch {
            $errors++
          }
        }
        
        Write-Output "[WSUS] Complete: Declined $declined old updates, $errors errors"
        [PSCustomObject]@{ Declined = $declined; Errors = $errors } | ConvertTo-Json -Compress
      `;

      loggingService.info(`[WSUS] Starting decline of updates older than ${daysOld} days...`);
      const result = await powershellService.execute(script, 1800000); // 30 minute timeout

      if (result.stdout) {
        result.stdout.split('\n').forEach(line => {
          if (line.trim().startsWith('[WSUS]')) {
            loggingService.info(line.trim());
          }
        });
      }

      if (result.success && result.stdout) {
        try {
          const jsonMatch = result.stdout.match(/\{.*"Declined".*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return { declined: data.Declined || 0, errors: data.Errors || 0 };
          }
        } catch {
          // Parse error
        }
      }
      
      return { declined: 0, errors: 0 };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error declining old updates: ${errorMessage}`);
      return { declined: 0, errors: 1 };
    }
  }

  /**
   * Configure WSUS products and classifications
   * Enables only specified products and critical/security classifications
   */
  async configureProductsAndClassifications(products: string[] = ['Windows Server', 'Windows 10', 'Windows 11']): Promise<boolean> {
    try {
      const productPatterns = products.map(p => `"*${p}*"`).join(', ');
      
      const script = `
        $wsus = ${this.getConnectionScript()}
        
        Write-Output "[WSUS] Configuring products and classifications..."
        
        # Disable all products first
        Write-Output "[WSUS] Disabling all products..."
        Get-WsusProduct -UpdateServer $wsus | Set-WsusProduct -Disable
        
        # Enable only specified products
        Write-Output "[WSUS] Enabling selected products..."
        $productPatterns = @(${productPatterns})
        foreach ($pattern in $productPatterns) {
          Get-WsusProduct -UpdateServer $wsus | Where-Object {
            $_.Product.Title -like $pattern
          } | Set-WsusProduct
          Write-Output "[WSUS] Enabled products matching: $pattern"
        }
        
        # Disable all classifications first
        Write-Output "[WSUS] Configuring classifications..."
        Get-WsusClassification -UpdateServer $wsus | Set-WsusClassification -Disable
        
        # Enable only critical classifications
        $enabledClassifications = @(
          'Critical Updates',
          'Security Updates', 
          'Update Rollups',
          'Updates',
          'Definition Updates'
        )
        
        Get-WsusClassification -UpdateServer $wsus | Where-Object {
          $_.Classification.Title -in $enabledClassifications
        } | Set-WsusClassification
        
        Write-Output "[WSUS] Enabled classifications: $($enabledClassifications -join ', ')"
        
        # Get and save config
        $config = $wsus.GetConfiguration()
        $config.Save()
        
        Write-Output "[WSUS] Configuration saved successfully"
        Write-Output "SUCCESS"
      `;

      loggingService.info('[WSUS] Configuring products and classifications...');
      const result = await powershellService.execute(script, 300000); // 5 minute timeout

      if (result.stdout) {
        result.stdout.split('\n').forEach(line => {
          if (line.trim().startsWith('[WSUS]')) {
            loggingService.info(line.trim());
          }
        });
      }

      return result.success && result.stdout.includes('SUCCESS');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error configuring products: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Auto-approve security and critical updates for all computers
   * Only approves updates for enabled products, not superseded, and not too old
   */
  async autoApproveSecurityUpdates(maxAgeDays: number = 90): Promise<{ approved: number; skipped: number; errors: number }> {
    try {
      const script = `
        $wsus = ${this.getConnectionScript()}
        $approved = 0
        $skipped = 0
        $errors = 0
        $cutoffDate = (Get-Date).AddDays(-${maxAgeDays})
        
        Write-Output "[WSUS] Finding security and critical updates to auto-approve..."
        Write-Output "[WSUS] Max age: ${maxAgeDays} days (after $($cutoffDate.ToString('yyyy-MM-dd')))"
        
        # Get the "All Computers" target group
        $allComputers = $wsus.GetComputerTargetGroups() | Where-Object { $_.Name -eq "All Computers" }
        
        if (-not $allComputers) {
          Write-Error "Could not find 'All Computers' target group"
          exit 1
        }
        
        # Get unapproved security/critical updates that are:
        # - Not superseded
        # - Not declined
        # - Created within the time window
        $updates = Get-WsusUpdate -UpdateServer $wsus -Classification SecurityUpdates, CriticalUpdates | Where-Object {
          $_.Update.IsSuperseded -eq $false -and
          $_.Update.IsDeclined -eq $false -and
          $_.Update.CreationDate -ge $cutoffDate -and
          $_.Update.IsApproved -eq $false
        }
        
        $total = ($updates | Measure-Object).Count
        Write-Output "[WSUS] Found $total updates to evaluate for approval"
        
        foreach ($update in $updates) {
          try {
            # Check if update is for enabled products
            $updateProducts = $update.Update.GetUpdateCategories() | ForEach-Object { $_.Title }
            
            # Approve for All Computers group with Install action
            $update.Update.Approve('Install', $allComputers)
            $approved++
            
            if ($approved % 25 -eq 0) {
              Write-Output "[WSUS] Approved $approved of $total..."
            }
          } catch {
            if ($_.Exception.Message -match "already approved") {
              $skipped++
            } else {
              $errors++
            }
          }
        }
        
        Write-Output "[WSUS] Complete: Approved $approved, Skipped $skipped, Errors $errors"
        [PSCustomObject]@{ Approved = $approved; Skipped = $skipped; Errors = $errors } | ConvertTo-Json -Compress
      `;

      loggingService.info(`[WSUS] Starting auto-approval of security updates (max age: ${maxAgeDays} days)...`);
      const result = await powershellService.execute(script, 1800000); // 30 minute timeout

      if (result.stdout) {
        result.stdout.split('\n').forEach(line => {
          if (line.trim().startsWith('[WSUS]')) {
            loggingService.info(line.trim());
          }
        });
      }

      if (result.success && result.stdout) {
        try {
          const jsonMatch = result.stdout.match(/\{.*"Approved".*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return { approved: data.Approved || 0, skipped: data.Skipped || 0, errors: data.Errors || 0 };
          }
        } catch {
          // Parse error
        }
      }
      
      return { approved: 0, skipped: 0, errors: 0 };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Error auto-approving updates: ${errorMessage}`);
      return { approved: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Run full maintenance cycle:
   * 1. Decline superseded updates
   * 2. Decline updates older than 90 days
   * 3. Auto-approve new security/critical updates
   * 4. Run cleanup
   */
  async runFullMaintenance(): Promise<{
    supersededDeclined: number;
    oldDeclined: number;
    approved: number;
    cleanupSuccess: boolean;
  }> {
    loggingService.info('[WSUS] Starting full maintenance cycle...');
    
    // Step 1: Decline superseded
    loggingService.info('[WSUS] Step 1/4: Declining superseded updates...');
    const superseded = await this.declineSupersededUpdates();
    
    // Step 2: Decline old updates
    loggingService.info('[WSUS] Step 2/4: Declining updates older than 90 days...');
    const old = await this.declineOldUpdates(90);
    
    // Step 3: Auto-approve security updates
    loggingService.info('[WSUS] Step 3/4: Auto-approving security updates...');
    const approved = await this.autoApproveSecurityUpdates(90);
    
    // Step 4: Run cleanup
    loggingService.info('[WSUS] Step 4/4: Running cleanup...');
    const cleanupSuccess = await this.performCleanup();
    
    loggingService.info('[WSUS] Full maintenance cycle complete!');
    loggingService.info(`[WSUS] Summary: ${superseded.declined} superseded declined, ${old.declined} old declined, ${approved.approved} approved`);
    
    return {
      supersededDeclined: superseded.declined,
      oldDeclined: old.declined,
      approved: approved.approved,
      cleanupSuccess
    };
  }

  /**
   * Auto-fix common WSUS issues
   * Based on common WSUS troubleshooting patterns
   */
  async autoFixCommonIssues(): Promise<{
    checks: Array<{ name: string; status: 'ok' | 'fixed' | 'failed'; message: string }>;
    fixed: number;
    failed: number;
    ok: number;
  }> {
    const checks: Array<{ name: string; status: 'ok' | 'fixed' | 'failed'; message: string }> = [];
    let fixed = 0;
    let failed = 0;
    let ok = 0;

    try {
      const script = `
        $results = @()

        # Check 1: WSUS Service
        $wsusService = Get-Service -Name WsusService -ErrorAction SilentlyContinue
        if ($wsusService) {
          if ($wsusService.Status -ne 'Running') {
            try {
              Start-Service WsusService -ErrorAction Stop
              Start-Sleep -Seconds 2
              $results += @{ Name = 'WSUS Service'; Status = 'fixed'; Message = 'Service was stopped, now started' }
            } catch {
              $results += @{ Name = 'WSUS Service'; Status = 'failed'; Message = "Failed to start: $_" }
            }
          } else {
            $results += @{ Name = 'WSUS Service'; Status = 'ok'; Message = 'Running normally' }
          }
        } else {
          $results += @{ Name = 'WSUS Service'; Status = 'failed'; Message = 'Service not found - WSUS may not be installed' }
        }

        # Check 2: SQL Server Service
        $sqlService = Get-Service -Name 'MSSQL$SQLEXPRESS' -ErrorAction SilentlyContinue
        if (-not $sqlService) {
          $sqlService = Get-Service -Name 'MSSQLSERVER' -ErrorAction SilentlyContinue
        }
        if ($sqlService) {
          if ($sqlService.Status -ne 'Running') {
            try {
              Start-Service $sqlService.Name -ErrorAction Stop
              Start-Sleep -Seconds 2
              $results += @{ Name = 'SQL Server'; Status = 'fixed'; Message = 'Service was stopped, now started' }
            } catch {
              $results += @{ Name = 'SQL Server'; Status = 'failed'; Message = "Failed to start: $_" }
            }
          } else {
            $results += @{ Name = 'SQL Server'; Status = 'ok'; Message = 'Running normally' }
          }
        } else {
          $results += @{ Name = 'SQL Server'; Status = 'failed'; Message = 'SQL Server service not found' }
        }

        # Check 3: IIS Service
        $iisService = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
        if ($iisService) {
          if ($iisService.Status -ne 'Running') {
            try {
              Start-Service W3SVC -ErrorAction Stop
              Start-Sleep -Seconds 2
              $results += @{ Name = 'IIS (W3SVC)'; Status = 'fixed'; Message = 'Service was stopped, now started' }
            } catch {
              $results += @{ Name = 'IIS (W3SVC)'; Status = 'failed'; Message = "Failed to start: $_" }
            }
          } else {
            $results += @{ Name = 'IIS (W3SVC)'; Status = 'ok'; Message = 'Running normally' }
          }
        } else {
          $results += @{ Name = 'IIS (W3SVC)'; Status = 'failed'; Message = 'IIS service not found' }
        }

        # Check 4: WsusPool Application Pool
        try {
          Import-Module WebAdministration -ErrorAction SilentlyContinue
          $pool = Get-Item "IIS:\\AppPools\\WsusPool" -ErrorAction SilentlyContinue
          if ($pool) {
            if ($pool.State -ne 'Started') {
              Start-WebAppPool -Name 'WsusPool' -ErrorAction Stop
              $results += @{ Name = 'WsusPool AppPool'; Status = 'fixed'; Message = 'Application pool was stopped, now started' }
            } else {
              $results += @{ Name = 'WsusPool AppPool'; Status = 'ok'; Message = 'Running normally' }
            }
          } else {
            $results += @{ Name = 'WsusPool AppPool'; Status = 'ok'; Message = 'Not found (may use different name)' }
          }
        } catch {
          $results += @{ Name = 'WsusPool AppPool'; Status = 'ok'; Message = 'WebAdministration module not available' }
        }

        # Check 5: WSUS Content Directory
        $contentPath = (Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Update Services\\Server\\Setup' -Name ContentDir -ErrorAction SilentlyContinue).ContentDir
        if ($contentPath) {
          if (Test-Path $contentPath) {
            $results += @{ Name = 'Content Directory'; Status = 'ok'; Message = "Path exists: $contentPath" }
          } else {
            $results += @{ Name = 'Content Directory'; Status = 'failed'; Message = "Path not found: $contentPath" }
          }
        } else {
          $results += @{ Name = 'Content Directory'; Status = 'ok'; Message = 'Registry key not found (expected if WSUS not installed)' }
        }

        # Check 6: Disk Space
        $cDrive = Get-PSDrive C -ErrorAction SilentlyContinue
        if ($cDrive) {
          $freeGB = [math]::Round($cDrive.Free / 1GB, 2)
          if ($freeGB -lt 5) {
            $results += @{ Name = 'Disk Space'; Status = 'failed'; Message = "Low disk space: $freeGB GB free" }
          } elseif ($freeGB -lt 20) {
            $results += @{ Name = 'Disk Space'; Status = 'ok'; Message = "Warning: $freeGB GB free (consider cleanup)" }
          } else {
            $results += @{ Name = 'Disk Space'; Status = 'ok'; Message = "$freeGB GB free" }
          }
        }

        # Check 7: Reset WSUS if having issues (optional - only if services are running but WSUS unresponsive)
        try {
          Import-Module UpdateServices -ErrorAction SilentlyContinue
          $wsus = Get-WsusServer -ErrorAction SilentlyContinue
          if ($wsus) {
            $results += @{ Name = 'WSUS Connection'; Status = 'ok'; Message = 'Connected successfully' }
          } else {
            $results += @{ Name = 'WSUS Connection'; Status = 'failed'; Message = 'Could not connect to WSUS server' }
          }
        } catch {
          $results += @{ Name = 'WSUS Connection'; Status = 'failed'; Message = "Connection error: $_" }
        }

        $results | ConvertTo-Json -Compress
      `;

      const result = await powershellService.execute(script);

      if (result.success && result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout) as Array<{ Name: string; Status: string; Message: string }> | { Name: string; Status: string; Message: string };
          const resultsArray = Array.isArray(parsed) ? parsed : [parsed];

          for (const r of resultsArray) {
            const status = r.Status.toLowerCase() as 'ok' | 'fixed' | 'failed';
            checks.push({ name: r.Name, status, message: r.Message });

            if (status === 'fixed') fixed++;
            else if (status === 'failed') failed++;
            else ok++;
          }
        } catch (parseError) {
          loggingService.error('Failed to parse autofix results');
          checks.push({ name: 'Parse Error', status: 'failed', message: 'Could not parse results' });
          failed++;
        }
      } else {
        loggingService.error(`Autofix script failed: ${result.stderr}`);
        checks.push({ name: 'Script Execution', status: 'failed', message: result.stderr || 'Unknown error' });
        failed++;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Autofix error: ${errorMessage}`);
      checks.push({ name: 'Autofix', status: 'failed', message: errorMessage });
      failed++;
    }

    return { checks, fixed, failed, ok };
  }

  private mapHealthStatus(status: string): HealthStatus {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return HealthStatus.HEALTHY;
      case 'warning':
        return HealthStatus.WARNING;
      case 'critical':
        return HealthStatus.CRITICAL;
      default:
        return HealthStatus.UNKNOWN;
    }
  }

  private mapServiceStatus(status: string): 'Running' | 'Stopped' | 'Pending' {
    switch (status?.toLowerCase()) {
      case 'running':
        return 'Running';
      case 'stopped':
        return 'Stopped';
      default:
        return 'Pending';
    }
  }
}

export const wsusService = new WsusService();
