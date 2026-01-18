/**
 * WSUS Computer Operations
 */

import { powershellService } from '../powershellService';
import { loggingService } from '../loggingService';
import { WsusComputer, EnvironmentStats, HealthStatus, DatabaseMetrics } from '../../types';
import { getConnectionScript } from './connection';

/**
 * Map string status to HealthStatus enum
 */
function mapHealthStatus(status: string): HealthStatus {
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

/**
 * Map service status string
 */
function mapServiceStatus(status: string): 'Running' | 'Stopped' | 'Pending' {
  switch (status?.toLowerCase()) {
    case 'running':
      return 'Running';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Pending';
  }
}

/**
 * Get all computers from WSUS
 */
export async function getComputers(): Promise<WsusComputer[]> {
  try {
    const script = `
      $wsus = ${getConnectionScript()}
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

    if (!result.success || !result.stdout) {
      loggingService.warn('Failed to retrieve WSUS computers. Returning empty list.');
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
    } catch {
      loggingService.error('Failed to parse computers JSON');
      return [];
    }

    const computerArray = Array.isArray(computers) ? computers : [computers];

    return computerArray.map((c: ParsedComputer, index: number) => ({
      id: (index + 1).toString(),
      name: c.Name || 'Unknown',
      ipAddress: c.IPAddress || '0.0.0.0',
      os: c.OS || 'Unknown OS',
      status: mapHealthStatus(c.Status || 'Unknown'),
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
export async function getStats(): Promise<EnvironmentStats | null> {
  try {
    const script = `
      $wsus = ${getConnectionScript()}
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
    } catch {
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
      } catch {
        loggingService.warn('Failed to parse disk space JSON');
      }
    }

    // Get database info (simplified)
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
          status: mapServiceStatus(data.WsusServiceStatus),
          lastCheck: 'Just now',
          type: 'WSUS'
        },
        {
          name: 'SQL Server (Express)',
          status: mapServiceStatus(data.SqlServiceStatus),
          lastCheck: 'Just now',
          type: 'SQL'
        },
        {
          name: 'IIS (W3SVC)',
          status: mapServiceStatus(data.IISServiceStatus),
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
