/**
 * STIG XML/XCCDF Parser
 */

import { loggingService } from '../loggingService';
import type { StigBenchmark, StigRule } from './types';
import { checkMappings } from './checkMappings';

/**
 * Determine if a check can be automated based on check content
 */
export function determineCheckType(checkContent: string): 'auto' | 'manual' {
  const autoPatterns = [
    /(?:service|verify).+(?:running|started|enabled)/i,
    /registry.+HKLM/i,
    /(?:feature|role).+(?:installed|enabled)/i,
    /firewall/i,
    /audit.+(?:success|failure)/i,
    /password.+policy/i,
    /get-service/i,
    /get-itemproperty/i,
    /powershell/i
  ];

  return autoPatterns.some(p => p.test(checkContent)) ? 'auto' : 'manual';
}

/**
 * Parse an XCCDF XML file
 */
export async function parseXccdfFile(filePath: string): Promise<StigBenchmark | null> {
  const { powershellService } = await import('../powershellService');

  // PowerShell script to parse XCCDF XML and extract rules
  const parseScript = `
    $ErrorActionPreference = 'Stop'
    $filePath = "${filePath.replace(/\\/g, '\\\\')}"
    
    try {
      [xml]$xml = Get-Content $filePath -Encoding UTF8
      
      # Find the Benchmark element (handles different namespace scenarios)
      $benchmark = $xml.Benchmark
      if (-not $benchmark) {
        $benchmark = $xml.SelectSingleNode("//*[local-name()='Benchmark']")
      }
      
      if (-not $benchmark) {
        Write-Output '{"error": "Not a valid XCCDF benchmark file"}'
        exit 0
      }
      
      # Extract benchmark info
      $benchmarkInfo = @{
        id = $benchmark.id
        title = ($benchmark.title | Select-Object -First 1).'#text'
        version = $benchmark.version
        description = ($benchmark.description | Select-Object -First 1).'#text'
      }
      
      if (-not $benchmarkInfo.title) {
        $benchmarkInfo.title = $benchmark.title
      }
      if (-not $benchmarkInfo.description) {
        $benchmarkInfo.description = $benchmark.description
      }
      
      # Extract rules
      $rules = @()
      $groups = $benchmark.Group
      if (-not $groups) {
        $groups = $benchmark.SelectNodes("//*[local-name()='Group']")
      }
      
      foreach ($group in $groups) {
        $rule = $group.Rule
        if (-not $rule) {
          $rule = $group.SelectSingleNode("*[local-name()='Rule']")
        }
        
        if ($rule) {
          # Get severity from rule
          $severity = $rule.severity
          if (-not $severity) { $severity = "medium" }
          
          $catLevel = switch ($severity.ToLower()) {
            "high"   { "CAT I" }
            "medium" { "CAT II" }
            "low"    { "CAT III" }
            default  { "CAT II" }
          }
          
          # Get check content
          $checkContent = ""
          $checkNode = $rule.check
          if ($checkNode) {
            $checkContentNode = $checkNode.'check-content'
            if ($checkContentNode) {
              $checkContent = $checkContentNode.'#text'
              if (-not $checkContent) { $checkContent = $checkContentNode }
            }
          }
          
          # Get fix text
          $fixText = ""
          $fixNode = $rule.fixtext
          if ($fixNode) {
            $fixText = $fixNode.'#text'
            if (-not $fixText) { $fixText = $fixNode }
          }
          
          # Get description
          $desc = $rule.description
          if ($desc -is [System.Xml.XmlElement]) {
            $desc = $desc.'#text'
          }
          
          # Get title
          $ruleTitle = $rule.title
          if ($ruleTitle -is [System.Xml.XmlElement]) {
            $ruleTitle = $ruleTitle.'#text'
          }
          
          $ruleObj = @{
            id = $group.id
            vulnId = $group.id
            ruleId = $rule.id
            title = $ruleTitle
            severity = $catLevel
            description = $desc
            checkContent = $checkContent
            fixText = $fixText
          }
          
          $rules += $ruleObj
        }
      }
      
      $result = @{
        benchmark = $benchmarkInfo
        rules = $rules
      }
      
      $result | ConvertTo-Json -Depth 10 -Compress
      
    } catch {
      Write-Output ('{"error": "' + $_.Exception.Message.Replace('"', "'") + '"}')
    }
  `;

  const result = await powershellService.execute(parseScript, 60000);

  if (!result.success || !result.stdout.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());

    if (parsed.error) {
      loggingService.warn(`[STIG] Parse warning for ${filePath}: ${parsed.error}`);
      return null;
    }

    const benchmark: StigBenchmark = {
      id: parsed.benchmark.id || `stig-${Date.now()}`,
      title: parsed.benchmark.title || 'Unknown STIG',
      version: parsed.benchmark.version || 'Unknown',
      releaseDate: new Date().toISOString(),
      description: parsed.benchmark.description || '',
      fileName: filePath,
      ruleCount: parsed.rules.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rules: parsed.rules.map((r: any, index: number) => ({
        id: r.id || `rule-${index}`,
        vulnId: r.vulnId || r.id || `V-${index}`,
        ruleId: r.ruleId || `SV-${index}`,
        stigId: parsed.benchmark.id,
        title: r.title || 'Unknown Rule',
        severity: r.severity || 'CAT II',
        description: r.description || '',
        checkContent: r.checkContent || '',
        fixText: r.fixText || '',
        checkType: determineCheckType(r.checkContent || '') as 'auto' | 'manual',
        status: 'Not Checked' as const,
        lastChecked: undefined
      }))
    };

    return benchmark;

  } catch (error) {
    loggingService.error(`[STIG] JSON parse error: ${error}`);
    return null;
  }
}

/**
 * Generate a generic PowerShell check based on rule keywords
 */
export function generateGenericCheck(rule: StigRule): string | null {
  const content = (rule.checkContent + ' ' + rule.title).toLowerCase();

  // WSUS-specific checks
  if (content.includes('wsus') && content.includes('service')) {
    return `
      $service = Get-Service -Name "WsusService" -ErrorAction SilentlyContinue
      if ($service -and $service.Status -eq 'Running') { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `;
  }

  // SQL Server checks
  if (content.includes('sql server') && content.includes('service')) {
    return `
      $services = Get-Service -Name "MSSQL*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }
      if ($services.Count -gt 0) { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `;
  }

  // IIS checks
  if (content.includes('iis') || content.includes('w3svc')) {
    return `
      $service = Get-Service -Name "W3SVC" -ErrorAction SilentlyContinue
      if ($service -and $service.Status -eq 'Running') { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `;
  }

  // HTTPS/SSL checks
  if (content.includes('https') || content.includes('ssl') || content.includes('tls')) {
    return `
      try {
        $wsusConfig = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Update Services\\Server\\Setup" -ErrorAction Stop
        if ($wsusConfig.UsingSSL -eq 1) { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
      } catch { Write-Output "OPEN" }
    `;
  }

  // Windows Update checks
  if (content.includes('windows update') || content.includes('automatic update')) {
    return `
      $au = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update" -ErrorAction SilentlyContinue
      if ($au -and $au.AUOptions -ge 3) { Write-Output "COMPLIANT" } else { Write-Output "OPEN" }
    `;
  }

  return null;
}
