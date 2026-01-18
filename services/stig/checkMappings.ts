/**
 * STIG Check Mappings
 * Maps STIG check content patterns to PowerShell commands
 */

import type { CheckMapping } from './types';

/**
 * Predefined check mappings from STIG check content to PowerShell commands
 */
export const checkMappings: CheckMapping[] = [
  // Service running checks
  {
    pattern: /(?:service|verify).+["']?(\w+)["']?.+(?:running|started|enabled)/i,
    command: (match) => `
      $service = Get-Service -Name "${match[1]}" -ErrorAction SilentlyContinue
      if ($service -and $service.Status -eq 'Running') { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `
  },
  // Registry value checks
  {
    pattern: /registry.+HKLM[:\\]+([\w\\]+).+["']?(\w+)["']?.+(?:set to|equal|value).+["']?(\w+)["']?/i,
    command: (match) => `
      try {
        $val = Get-ItemProperty -Path "HKLM:\\${match[1]}" -Name "${match[2]}" -ErrorAction Stop
        if ($val."${match[2]}" -eq "${match[3]}") { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
      } catch { Write-Output "OPEN" }
    `
  },
  // Windows Feature checks
  {
    pattern: /(?:feature|role).+["']?([\w-]+)["']?.+(?:installed|enabled)/i,
    command: (match) => `
      $feature = Get-WindowsFeature -Name "${match[1]}" -ErrorAction SilentlyContinue
      if ($feature -and $feature.Installed) { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `
  },
  // Firewall enabled check
  {
    pattern: /(?:windows firewall|firewall profile).+(?:enabled|on)/i,
    command: () => `
      $profiles = Get-NetFirewallProfile | Where-Object { $_.Enabled -eq $true }
      if ($profiles.Count -eq 3) { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `
  },
  // Audit policy checks
  {
    pattern: /audit.+["']?([\w\s]+)["']?.+(?:success|failure|enabled)/i,
    command: (match) => `
      $audit = auditpol /get /subcategory:"${match[1]}" 2>$null
      if ($audit -match "Success|Failure") { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `
  },
  // Local policy / security setting checks
  {
    pattern: /(?:password|account|lockout).+(?:policy|setting)/i,
    command: () => `
      # Password policy check - requires secedit export
      $tempFile = "$env:TEMP\\secpol_$(Get-Random).cfg"
      secedit /export /cfg $tempFile /quiet 2>$null
      if (Test-Path $tempFile) {
        $content = Get-Content $tempFile -Raw
        Remove-Item $tempFile -Force
        if ($content -match "MinimumPasswordLength\\s*=\\s*(\\d+)" -and [int]$Matches[1] -ge 14) {
          Write-Output "COMPLIANT"
        } else {
          Write-Output "OPEN"
        }
      } else {
        Write-Output "OPEN"
      }
    `
  }
];
