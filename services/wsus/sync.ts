/**
 * WSUS Sync Operations
 */

import { powershellService } from '../powershellService';
import { loggingService } from '../loggingService';
import type { SyncResult, SyncStatus } from './types';

/**
 * Trigger WSUS synchronization
 */
export async function syncNow(): Promise<SyncResult> {
  try {
    const script = `
      Write-Output "[SYNC] Starting WSUS synchronization..."
      
      try {
        $wsus = Get-WsusServer -Name localhost -PortNumber 8530
        $subscription = $wsus.GetSubscription()
        
        # Check if sync is already running
        $status = $subscription.GetSynchronizationStatus()
        if ($status -eq 'Running') {
          Write-Output "[SYNC] Synchronization already in progress"
          [PSCustomObject]@{ Success = $true; Message = "Sync already in progress" } | ConvertTo-Json -Compress
          exit
        }
        
        # Start synchronization
        Write-Output "[SYNC] Triggering sync..."
        $subscription.StartSynchronization()
        
        Write-Output "[SYNC] Synchronization started successfully"
        [PSCustomObject]@{ Success = $true; Message = "Synchronization started" } | ConvertTo-Json -Compress
        
      } catch {
        Write-Output "[SYNC] Error: $_"
        [PSCustomObject]@{ Success = $false; Message = $_.Exception.Message } | ConvertTo-Json -Compress
      }
    `;

    loggingService.info('[WSUS] Triggering synchronization...');
    const result = await powershellService.execute(script, 60000);

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim().startsWith('[SYNC]')) {
          loggingService.info(line.trim());
        }
      });
    }

    if (result.success && result.stdout) {
      try {
        const jsonMatch = result.stdout.match(/\{.*"Success".*\}/s);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return { success: data.Success || false, message: data.Message || '' };
        }
      } catch {
        loggingService.warn('[WSUS] Failed to parse syncNow response');
      }
    }

    return { success: false, message: 'Failed to start synchronization' };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error starting sync: ${errorMessage}`);
    return { success: false, message: errorMessage };
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const defaultStatus: SyncStatus = {
    status: 'Unknown',
    lastSyncTime: 'Never',
    lastSyncResult: 'Unknown',
    nextSyncTime: 'Not scheduled'
  };

  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $subscription = $wsus.GetSubscription()
      
      $status = $subscription.GetSynchronizationStatus()
      $lastSync = $subscription.LastSynchronizationTime
      $progress = $subscription.GetSynchronizationProgress()
      
      [PSCustomObject]@{
        Status = $status.ToString()
        LastSyncTime = if ($lastSync -and $lastSync -gt [DateTime]::MinValue) { $lastSync.ToString("yyyy-MM-dd HH:mm:ss") } else { "Never" }
        LastSyncResult = $subscription.LastSynchronizationResult.ToString()
        NextSyncTime = if ($subscription.NextSynchronizationTime -and $subscription.NextSynchronizationTime -gt [DateTime]::Now) { $subscription.NextSynchronizationTime.ToString("yyyy-MM-dd HH:mm:ss") } else { "Not scheduled" }
      } | ConvertTo-Json -Compress
    `;

    const result = await powershellService.execute(script, 15000);

    if (result.success && result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        return {
          status: data.Status || 'Unknown',
          lastSyncTime: data.LastSyncTime || 'Never',
          lastSyncResult: data.LastSyncResult || 'Unknown',
          nextSyncTime: data.NextSyncTime || 'Not scheduled'
        };
      } catch {
        loggingService.warn('[WSUS] Failed to parse getSyncStatus response');
      }
    }
    return defaultStatus;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error getting sync status: ${errorMessage}`);
    return { ...defaultStatus, status: 'Error', lastSyncResult: errorMessage };
  }
}
