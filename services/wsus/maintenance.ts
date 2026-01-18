/**
 * WSUS Maintenance Operations
 */

import { powershellService } from '../powershellService';
import { loggingService } from '../loggingService';
import { getConnectionScript } from './connection';
import { declineSupersededUpdates, declineOldUpdates, autoApproveSecurityUpdates } from './updates';
import type { HealthCheckResult, MaintenanceResult } from './types';

/**
 * Execute WSUS cleanup
 */
export async function performCleanup(): Promise<boolean> {
  try {
    const script = `
      $wsus = ${getConnectionScript()}
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
 * Configure WSUS products and classifications
 */
export async function configureProductsAndClassifications(
  products: string[] = ['Windows Server', 'Windows 10', 'Windows 11']
): Promise<boolean> {
  try {
    const productPatterns = products.map(p => `"*${p}*"`).join(', ');

    const script = `
      $wsus = ${getConnectionScript()}
      
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
    const result = await powershellService.execute(script, 300000);

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
 * Perform WSUS health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const defaultResult: HealthCheckResult = {
    healthy: false,
    services: [],
    database: { connected: false, sizeGB: 0, lastBackup: 'Unknown' },
    sync: { lastSync: 'Unknown', nextSync: 'Unknown', status: 'Unknown' },
    issues: ['Health check failed to execute']
  };

  try {
    const script = `
      $issues = @()
      $healthy = $true
      
      Write-Output "[HEALTH] Starting WSUS health check..."
      
      # Check services
      Write-Output "[HEALTH] Checking services..."
      $wsusService = Get-Service -Name WsusService -ErrorAction SilentlyContinue
      $sqlService = Get-Service -Name 'MSSQL$SQLEXPRESS' -ErrorAction SilentlyContinue
      $iisService = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
      
      $services = @()
      
      if ($wsusService) {
        $wsusHealthy = $wsusService.Status -eq 'Running'
        $services += @{ Name = 'WSUS Service'; Status = $wsusService.Status.ToString(); Healthy = $wsusHealthy }
        if (-not $wsusHealthy) { $issues += 'WSUS Service is not running'; $healthy = $false }
      } else {
        $services += @{ Name = 'WSUS Service'; Status = 'Not Found'; Healthy = $false }
        $issues += 'WSUS Service not found'
        $healthy = $false
      }
      
      if ($sqlService) {
        $sqlHealthy = $sqlService.Status -eq 'Running'
        $services += @{ Name = 'SQL Server'; Status = $sqlService.Status.ToString(); Healthy = $sqlHealthy }
        if (-not $sqlHealthy) { $issues += 'SQL Server is not running'; $healthy = $false }
      } else {
        $services += @{ Name = 'SQL Server'; Status = 'Not Found'; Healthy = $false }
        $issues += 'SQL Server not found'
        $healthy = $false
      }
      
      if ($iisService) {
        $iisHealthy = $iisService.Status -eq 'Running'
        $services += @{ Name = 'IIS (W3SVC)'; Status = $iisService.Status.ToString(); Healthy = $iisHealthy }
        if (-not $iisHealthy) { $issues += 'IIS is not running'; $healthy = $false }
      } else {
        $services += @{ Name = 'IIS (W3SVC)'; Status = 'Not Found'; Healthy = $false }
        $issues += 'IIS not found'
        $healthy = $false
      }
      
      # Check database
      Write-Output "[HEALTH] Checking database..."
      $dbConnected = $false
      $dbSizeGB = 0
      $lastBackup = 'Unknown'
      
      try {
        $dbResult = Invoke-Sqlcmd -ServerInstance "localhost\\SQLEXPRESS" -Database "SUSDB" -Query "SELECT 1 as Test" -ErrorAction Stop
        $dbConnected = $true
        
        $sizeResult = Invoke-Sqlcmd -ServerInstance "localhost\\SQLEXPRESS" -Database "SUSDB" -Query "
          SELECT CAST(SUM(size) * 8.0 / 1024 / 1024 AS DECIMAL(10,2)) as SizeGB
          FROM sys.master_files WHERE database_id = DB_ID('SUSDB')
        " -ErrorAction SilentlyContinue
        if ($sizeResult) { $dbSizeGB = $sizeResult.SizeGB }
        
        $backupResult = Invoke-Sqlcmd -ServerInstance "localhost\\SQLEXPRESS" -Query "
          SELECT TOP 1 backup_finish_date 
          FROM msdb.dbo.backupset 
          WHERE database_name = 'SUSDB' 
          ORDER BY backup_finish_date DESC
        " -ErrorAction SilentlyContinue
        if ($backupResult -and $backupResult.backup_finish_date) {
          $lastBackup = $backupResult.backup_finish_date.ToString('yyyy-MM-dd HH:mm')
        } else {
          $lastBackup = 'Never'
          $issues += 'No database backup found'
        }
      } catch {
        $issues += 'Cannot connect to SUSDB database'
        $healthy = $false
      }
      
      # Check WSUS sync status
      Write-Output "[HEALTH] Checking sync status..."
      $lastSync = 'Unknown'
      $nextSync = 'Unknown'
      $syncStatus = 'Unknown'
      
      try {
        $wsus = Get-WsusServer -Name localhost -PortNumber 8530 -ErrorAction Stop
        $syncInfo = $wsus.GetSubscription()
        $lastSync = if ($syncInfo.LastSynchronizationTime) { $syncInfo.LastSynchronizationTime.ToString('yyyy-MM-dd HH:mm') } else { 'Never' }
        $nextSync = if ($syncInfo.NextSynchronizationTime) { $syncInfo.NextSynchronizationTime.ToString('yyyy-MM-dd HH:mm') } else { 'Not scheduled' }
        $syncStatus = $syncInfo.GetSynchronizationStatus().ToString()
        
        if ($syncInfo.LastSynchronizationTime -and $syncInfo.LastSynchronizationTime -lt (Get-Date).AddDays(-7)) {
          $issues += 'WSUS has not synchronized in over 7 days'
        }
      } catch {
        $issues += 'Cannot connect to WSUS server'
        $healthy = $false
      }
      
      Write-Output "[HEALTH] Health check complete. Healthy: $healthy"
      
      [PSCustomObject]@{
        Healthy = $healthy
        Services = $services
        Database = @{ Connected = $dbConnected; SizeGB = $dbSizeGB; LastBackup = $lastBackup }
        Sync = @{ LastSync = $lastSync; NextSync = $nextSync; Status = $syncStatus }
        Issues = $issues
      } | ConvertTo-Json -Depth 3 -Compress
    `;

    loggingService.info('[WSUS] Running health check...');
    const result = await powershellService.execute(script, 120000);

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim().startsWith('[HEALTH]')) {
          loggingService.info(line.trim());
        }
      });
    }

    if (result.success && result.stdout) {
      try {
        const jsonMatch = result.stdout.match(/\{.*"Healthy".*\}/s);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return {
            healthy: data.Healthy || false,
            services: data.Services || [],
            database: {
              connected: data.Database?.Connected || false,
              sizeGB: data.Database?.SizeGB || 0,
              lastBackup: data.Database?.LastBackup || 'Unknown'
            },
            sync: {
              lastSync: data.Sync?.LastSync || 'Unknown',
              nextSync: data.Sync?.NextSync || 'Unknown',
              status: data.Sync?.Status || 'Unknown'
            },
            issues: data.Issues || []
          };
        }
      } catch {
        loggingService.warn('[WSUS] Failed to parse performHealthCheck response');
      }
    }

    return defaultResult;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error performing health check: ${errorMessage}`);
    return { ...defaultResult, issues: [errorMessage] };
  }
}

/**
 * Run full maintenance cycle
 */
export async function runFullMaintenance(): Promise<MaintenanceResult> {
  loggingService.info('[WSUS] Starting full maintenance cycle...');

  // Step 1: Decline superseded
  loggingService.info('[WSUS] Step 1/4: Declining superseded updates...');
  const superseded = await declineSupersededUpdates();

  // Step 2: Decline old updates
  loggingService.info('[WSUS] Step 2/4: Declining updates older than 90 days...');
  const old = await declineOldUpdates(90);

  // Step 3: Auto-approve security updates
  loggingService.info('[WSUS] Step 3/4: Auto-approving security updates...');
  const approved = await autoApproveSecurityUpdates(90);

  // Step 4: Run cleanup
  loggingService.info('[WSUS] Step 4/4: Running cleanup...');
  const cleanupSuccess = await performCleanup();

  loggingService.info('[WSUS] Full maintenance cycle complete!');
  loggingService.info(`[WSUS] Summary: ${superseded.declined} superseded declined, ${old.declined} old declined, ${approved.approved} approved`);

  return {
    supersededDeclined: superseded.declined,
    oldDeclined: old.declined,
    approved: approved.approved,
    cleanupSuccess
  };
}
