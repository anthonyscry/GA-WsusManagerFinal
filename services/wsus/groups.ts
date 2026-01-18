/**
 * WSUS Group Operations
 */

import { powershellService } from '../powershellService';
import { loggingService } from '../loggingService';
import type { ComputerGroup, GroupComputer } from './types';

/**
 * Get all computer target groups
 */
export async function getComputerGroups(): Promise<ComputerGroup[]> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $groups = $wsus.GetComputerTargetGroups()
      
      $groups | ForEach-Object {
        [PSCustomObject]@{
          Id = $_.Id.ToString()
          Name = $_.Name
          ComputerCount = ($wsus.GetComputerTargets() | Where-Object { $_.ComputerTargetGroupIds -contains $_.Id }).Count
        }
      } | ConvertTo-Json -Compress
    `;

    const result = await powershellService.execute(script, 30000);

    if (result.success && result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        const groups = Array.isArray(data) ? data : [data];
        return groups.map((g: { Id?: string; Name?: string; ComputerCount?: number }) => ({
          id: g.Id || '',
          name: g.Name || '',
          computerCount: g.ComputerCount || 0
        }));
      } catch {
        loggingService.warn('[WSUS] Failed to parse getComputerGroups response');
      }
    }
    return [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error getting computer groups: ${errorMessage}`);
    return [];
  }
}

/**
 * Get computers in a specific group
 */
export async function getComputersInGroup(groupName: string): Promise<GroupComputer[]> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $group = $wsus.GetComputerTargetGroups() | Where-Object { $_.Name -eq "${groupName}" }
      
      if (-not $group) {
        Write-Output "[]"
        exit
      }
      
      $computers = $wsus.GetComputerTargets() | Where-Object { 
        $_.ComputerTargetGroupIds -contains $group.Id 
      }
      
      $computers | ForEach-Object {
        [PSCustomObject]@{
          Id = $_.Id
          Name = $_.FullDomainName
          IpAddress = $_.IPAddress
          LastReported = if ($_.LastReportedStatusTime) { $_.LastReportedStatusTime.ToString("yyyy-MM-dd HH:mm") } else { "Never" }
        }
      } | ConvertTo-Json -Compress
    `;

    const result = await powershellService.execute(script, 30000);

    if (result.success && result.stdout) {
      try {
        const data = JSON.parse(result.stdout);
        const computers = Array.isArray(data) ? data : (data ? [data] : []);
        return computers.map((c: { Id?: string; Name?: string; IpAddress?: string; LastReported?: string }) => ({
          id: c.Id || '',
          name: c.Name || '',
          ipAddress: c.IpAddress || '',
          lastReported: c.LastReported || 'Never'
        }));
      } catch {
        loggingService.warn('[WSUS] Failed to parse getComputersInGroup response');
      }
    }
    return [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error getting computers in group: ${errorMessage}`);
    return [];
  }
}

/**
 * Move computer to a different group
 */
export async function moveComputerToGroup(computerId: string, targetGroupName: string): Promise<boolean> {
  try {
    const script = `
      $wsus = Get-WsusServer -Name localhost -PortNumber 8530
      $targetGroup = $wsus.GetComputerTargetGroups() | Where-Object { $_.Name -eq "${targetGroupName}" }
      
      if (-not $targetGroup) {
        Write-Output "GROUP_NOT_FOUND"
        exit
      }
      
      $computer = $wsus.GetComputerTarget("${computerId}")
      if (-not $computer) {
        Write-Output "COMPUTER_NOT_FOUND"
        exit
      }
      
      # Remove from all non-system groups first
      $allGroups = $wsus.GetComputerTargetGroups() | Where-Object { 
        $_.Name -ne "All Computers" -and $_.Name -ne "Unassigned Computers"
      }
      foreach ($group in $allGroups) {
        try { $group.RemoveComputerTarget($computer) } catch { }
      }
      
      # Add to target group
      $targetGroup.AddComputerTarget($computer)
      Write-Output "SUCCESS"
    `;

    const result = await powershellService.execute(script, 30000);
    return result.stdout.includes('SUCCESS');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggingService.error(`Error moving computer to group: ${errorMessage}`);
    return false;
  }
}
