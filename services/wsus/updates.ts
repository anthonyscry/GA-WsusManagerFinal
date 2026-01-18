/**
 * WSUS Update Operations
 */

import { powershellService } from '../powershellService';
import { loggingService } from '../loggingService';
import type { PendingUpdate, ApprovalResult, DeclineResult, AutoApproveResult } from './types';

/**
 * Get pending updates for approval
 */
export async function getPendingUpdates(): Promise<PendingUpdate[]> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      
      $updates = Get-WsusUpdate -UpdateServer $wsus | Where-Object {
        $_.Update.IsDeclined -eq $false -and
        $_.Update.IsApproved -eq $false -and
        $_.Update.IsSuperseded -eq $false
      } | Select-Object -First 100
      
      $updates | ForEach-Object {
        [PSCustomObject]@{
          Id = $_.Update.Id.UpdateId.ToString()
          Title = $_.Update.Title
          Classification = $_.Update.UpdateClassificationTitle
          Severity = if ($_.Update.MsrcSeverity) { $_.Update.MsrcSeverity } else { "Unknown" }
          ReleaseDate = $_.Update.CreationDate.ToString("yyyy-MM-dd")
        }
      } | ConvertTo-Json -Compress
    `;

    const result = await powershellService.execute(script, 60000);

    if (result.success && result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        const updates = Array.isArray(data) ? data : [data];
        type UpdateData = { Id?: string; Title?: string; Classification?: string; Severity?: string; ReleaseDate?: string };
        return updates.filter((u: UpdateData) => u && u.Id).map((u: UpdateData) => ({
          id: u.Id || '',
          title: u.Title || '',
          classification: u.Classification || '',
          severity: u.Severity || 'Unknown',
          releaseDate: u.ReleaseDate || ''
        }));
      } catch {
        loggingService.warn('[WSUS] Failed to parse getPendingUpdates response');
      }
    }
    return [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error getting pending updates: ${errorMessage}`);
    return [];
  }
}

/**
 * Approve specific updates for a target group
 */
export async function approveUpdates(updateIds: string[], targetGroupName: string = 'All Computers'): Promise<ApprovalResult> {
  try {
    const updateIdList = updateIds.map(id => `"${id}"`).join(',');

    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $approved = 0
      $failed = 0
      
      $targetGroup = $wsus.GetComputerTargetGroups() | Where-Object { $_.Name -eq "${targetGroupName}" }
      if (-not $targetGroup) {
        Write-Error "Target group not found: ${targetGroupName}"
        [PSCustomObject]@{ Approved = 0; Failed = ${updateIds.length} } | ConvertTo-Json -Compress
        exit
      }
      
      $updateIds = @(${updateIdList})
      
      foreach ($updateId in $updateIds) {
        try {
          $update = Get-WsusUpdate -UpdateServer $wsus | Where-Object { $_.Update.Id.UpdateId.ToString() -eq $updateId }
          if ($update) {
            $update.Update.Approve('Install', $targetGroup)
            $approved++
          } else {
            $failed++
          }
        } catch {
          $failed++
        }
      }
      
      [PSCustomObject]@{ Approved = $approved; Failed = $failed } | ConvertTo-Json -Compress
    `;

    const result = await powershellService.execute(script, 120000);

    if (result.success && result.stdout) {
      try {
        const jsonMatch = result.stdout.match(/\{.*"Approved".*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return { approved: data.Approved || 0, failed: data.Failed || 0 };
        }
      } catch {
        loggingService.warn('[WSUS] Failed to parse approveUpdates response');
      }
    }
    return { approved: 0, failed: updateIds.length };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error approving updates: ${errorMessage}`);
    return { approved: 0, failed: updateIds.length };
  }
}

/**
 * Decline specific updates
 */
export async function declineUpdates(updateIds: string[]): Promise<DeclineResult> {
  try {
    const updateIdList = updateIds.map(id => `"${id}"`).join(',');

    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $declined = 0
      $failed = 0
      
      $updateIds = @(${updateIdList})
      
      foreach ($updateId in $updateIds) {
        try {
          $update = Get-WsusUpdate -UpdateServer $wsus | Where-Object { $_.Update.Id.UpdateId.ToString() -eq $updateId }
          if ($update) {
            $update.Update.Decline()
            $declined++
          } else {
            $failed++
          }
        } catch {
          $failed++
        }
      }
      
      [PSCustomObject]@{ Declined = $declined; Failed = $failed } | ConvertTo-Json -Compress
    `;

    const result = await powershellService.execute(script, 120000);

    if (result.success && result.stdout) {
      try {
        const jsonMatch = result.stdout.match(/\{.*"Declined".*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return { declined: data.Declined || 0, failed: data.Failed || 0 };
        }
      } catch {
        loggingService.warn('[WSUS] Failed to parse declineUpdates response');
      }
    }
    return { declined: 0, failed: updateIds.length };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error declining updates: ${errorMessage}`);
    return { declined: 0, failed: updateIds.length };
  }
}

/**
 * Decline all superseded updates
 */
export async function declineSupersededUpdates(): Promise<DeclineResult> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
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
    const result = await powershellService.execute(script, 1800000);

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
        loggingService.warn('[WSUS] Failed to parse declineSupersededUpdates response');
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
 */
export async function declineOldUpdates(daysOld: number = 90): Promise<DeclineResult> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $declined = 0
      $errors = 0
      $cutoffDate = (Get-Date).AddDays(-${daysOld})
      
      Write-Output "[WSUS] Finding updates older than ${daysOld} days..."
      
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
    const result = await powershellService.execute(script, 1800000);

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
        loggingService.warn('[WSUS] Failed to parse declineOldUpdates response');
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
 * Decline all driver updates
 */
export async function declineDriverUpdates(): Promise<DeclineResult> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $declined = 0
      $errors = 0
      
      Write-Output "[WSUS] Finding driver updates..."
      
      $drivers = Get-WsusUpdate -UpdateServer $wsus -Classification Drivers | Where-Object {
        $_.Update.IsDeclined -eq $false
      }
      
      $total = ($drivers | Measure-Object).Count
      Write-Output "[WSUS] Found $total driver updates to decline"
      
      foreach ($update in $drivers) {
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
      
      Write-Output "[WSUS] Complete: Declined $declined driver updates, $errors errors"
      [PSCustomObject]@{ Declined = $declined; Errors = $errors } | ConvertTo-Json -Compress
    `;

    loggingService.info('[WSUS] Starting decline of driver updates...');
    const result = await powershellService.execute(script, 1800000);

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
        loggingService.warn('[WSUS] Failed to parse declineDriverUpdates response');
      }
    }

    return { declined: 0, errors: 0 };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error declining driver updates: ${errorMessage}`);
    return { declined: 0, errors: 1 };
  }
}

/**
 * Auto-approve security and critical updates
 */
export async function autoApproveSecurityUpdates(maxAgeDays: number = 90): Promise<AutoApproveResult> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $approved = 0
      $skipped = 0
      $errors = 0
      $cutoffDate = (Get-Date).AddDays(-${maxAgeDays})
      
      Write-Output "[WSUS] Finding security and critical updates to auto-approve..."
      
      $allComputers = $wsus.GetComputerTargetGroups() | Where-Object { $_.Name -eq "All Computers" }
      
      if (-not $allComputers) {
        Write-Error "Could not find 'All Computers' target group"
        exit 1
      }
      
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
    const result = await powershellService.execute(script, 1800000);

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
        loggingService.warn('[WSUS] Failed to parse autoApproveSecurityUpdates response');
      }
    }

    return { approved: 0, skipped: 0, errors: 0 };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error auto-approving updates: ${errorMessage}`);
    return { approved: 0, skipped: 0, errors: 1 };
  }
}
