/**
 * STIG Service
 * Parses and manages DISA STIG files (XCCDF XML format)
 * Users can download official STIGs from: https://public.cyber.mil/stigs/downloads/
 */

import { loggingService } from './loggingService';

// STIG Rule from parsed XCCDF file
export interface StigRule {
  id: string;
  vulnId: string;           // V-XXXXXX
  ruleId: string;           // SV-XXXXXX
  stigId: string;           // Which STIG file this came from
  title: string;
  severity: 'CAT I' | 'CAT II' | 'CAT III';
  description: string;
  checkContent: string;     // What to check (from XCCDF)
  fixText: string;          // How to fix it
  checkType: 'auto' | 'manual';  // Can we auto-check this?
  status: 'Not Checked' | 'Compliant' | 'Open' | 'Not Applicable' | 'Error';
  lastChecked?: Date;
}

// Parsed STIG file info
export interface StigBenchmark {
  id: string;
  title: string;
  version: string;
  releaseDate: string;
  description: string;
  fileName: string;
  ruleCount: number;
  rules: StigRule[];
}

// STIG Directory configuration
export interface StigConfig {
  stigDirectory: string;
  autoScanOnStartup: boolean;
  lastScanDate?: string;
}

// Check mapping - maps STIG check patterns to PowerShell commands
interface CheckMapping {
  pattern: RegExp;
  command: (match: RegExpMatchArray, rule: StigRule) => string;
}

class StigService {
  private benchmarks: StigBenchmark[] = [];
  private config: StigConfig = {
    stigDirectory: 'C:\\STIG_Files',
    autoScanOnStartup: true
  };
  
  // Mappings from STIG check content to PowerShell commands
  private checkMappings: CheckMapping[] = [
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

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('stigConfig');
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      loggingService.error(`[STIG] Failed to load config: ${error}`);
    }
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig(config: Partial<StigConfig>): void {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem('stigConfig', JSON.stringify(this.config));
      loggingService.info('[STIG] Configuration saved');
    } catch (error) {
      loggingService.error(`[STIG] Failed to save config: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): StigConfig {
    return { ...this.config };
  }

  /**
   * Get loaded benchmarks
   */
  getBenchmarks(): StigBenchmark[] {
    return [...this.benchmarks];
  }

  /**
   * Get all rules from all loaded benchmarks
   */
  getAllRules(): StigRule[] {
    return this.benchmarks.flatMap(b => b.rules);
  }

  /**
   * Scan STIG directory for XML/XCCDF files
   */
  async scanDirectory(): Promise<StigBenchmark[]> {
    const { powershellService } = await import('./powershellService');
    
    loggingService.info(`[STIG] Scanning directory: ${this.config.stigDirectory}`);
    
    // Get list of STIG files
    const listScript = `
      $path = "${this.config.stigDirectory.replace(/\\/g, '\\\\')}"
      if (Test-Path $path) {
        Get-ChildItem -Path $path -Filter "*.xml" -Recurse | 
          Where-Object { $_.Name -match "xccdf|stig|benchmark" -or (Get-Content $_.FullName -First 5 -Raw) -match "Benchmark" } |
          Select-Object -ExpandProperty FullName |
          ConvertTo-Json
      } else {
        Write-Output "[]"
      }
    `;
    
    const result = await powershellService.execute(listScript, 30000);
    
    if (!result.success) {
      loggingService.error(`[STIG] Failed to scan directory: ${result.stderr}`);
      return [];
    }
    
    let files: string[] = [];
    try {
      const output = result.stdout.trim();
      if (output && output !== '[]') {
        const parsed = JSON.parse(output);
        files = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch {
      loggingService.error('[STIG] Failed to parse file list');
      return [];
    }
    
    loggingService.info(`[STIG] Found ${files.length} potential STIG files`);
    
    // Parse each file
    this.benchmarks = [];
    for (const file of files) {
      try {
        const benchmark = await this.parseXccdfFile(file);
        if (benchmark) {
          this.benchmarks.push(benchmark);
          loggingService.info(`[STIG] Loaded: ${benchmark.title} (${benchmark.ruleCount} rules)`);
        }
      } catch (error) {
        loggingService.error(`[STIG] Failed to parse ${file}: ${error}`);
      }
    }
    
    this.config.lastScanDate = new Date().toISOString();
    this.saveConfig({});
    
    return this.benchmarks;
  }

  /**
   * Parse an XCCDF XML file
   */
  private async parseXccdfFile(filePath: string): Promise<StigBenchmark | null> {
    const { powershellService } = await import('./powershellService');
    
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
          checkType: this.determineCheckType(r.checkContent || '') as 'auto' | 'manual',
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
   * Determine if a check can be automated based on check content
   */
  private determineCheckType(checkContent: string): 'auto' | 'manual' {
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
   * Run compliance checks for all loaded rules (or specific benchmark)
   */
  async runComplianceChecks(benchmarkId?: string): Promise<StigRule[]> {
    const { powershellService } = await import('./powershellService');
    
    const rulesToCheck = benchmarkId 
      ? this.benchmarks.find(b => b.id === benchmarkId)?.rules || []
      : this.getAllRules();
    
    loggingService.info(`[STIG] Running compliance checks on ${rulesToCheck.length} rules`);
    
    const results: StigRule[] = [];
    
    for (const rule of rulesToCheck) {
      const updatedRule = { ...rule };
      
      if (rule.checkType === 'manual') {
        updatedRule.status = 'Not Checked';
        updatedRule.lastChecked = new Date();
        results.push(updatedRule);
        continue;
      }
      
      // Try to find a matching check command
      let checkCommand: string | null = null;
      
      for (const mapping of this.checkMappings) {
        const match = rule.checkContent.match(mapping.pattern);
        if (match) {
          checkCommand = mapping.command(match, rule);
          break;
        }
      }
      
      if (!checkCommand) {
        // Try generic checks based on keywords
        checkCommand = this.generateGenericCheck(rule);
      }
      
      if (checkCommand) {
        try {
          const result = await powershellService.execute(checkCommand, 15000);
          const output = result.stdout.trim().toUpperCase();
          
          if (output === 'COMPLIANT') {
            updatedRule.status = 'Compliant';
          } else if (output === 'OPEN' || output === 'NOT COMPLIANT') {
            updatedRule.status = 'Open';
          } else if (output === 'NOT_APPLICABLE' || output === 'N/A') {
            updatedRule.status = 'Not Applicable';
          } else {
            updatedRule.status = 'Not Checked';
          }
        } catch {
          updatedRule.status = 'Error';
        }
      } else {
        updatedRule.status = 'Not Checked';
      }
      
      updatedRule.lastChecked = new Date();
      results.push(updatedRule);
    }
    
    // Update the stored rules with results
    for (const benchmark of this.benchmarks) {
      for (let i = 0; i < benchmark.rules.length; i++) {
        const result = results.find(r => r.id === benchmark.rules[i].id && r.stigId === benchmark.id);
        if (result) {
          benchmark.rules[i] = result;
        }
      }
    }
    
    loggingService.info(`[STIG] Compliance check complete`);
    return results;
  }

  /**
   * Generate a generic PowerShell check based on rule keywords
   */
  private generateGenericCheck(rule: StigRule): string | null {
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

  /**
   * Export compliance results to CSV
   */
  async exportResults(outputPath: string): Promise<boolean> {
    const { powershellService } = await import('./powershellService');
    
    const rules = this.getAllRules();
    const csvData = rules.map(r => ({
      'Vuln ID': r.vulnId,
      'Rule ID': r.ruleId,
      'STIG': r.stigId,
      'Title': r.title.replace(/"/g, '""'),
      'Severity': r.severity,
      'Status': r.status,
      'Check Type': r.checkType,
      'Last Checked': r.lastChecked?.toISOString() || 'Never'
    }));
    
    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');
    
    const escapedPath = outputPath.replace(/\\/g, '\\\\');
    const escapedContent = csvContent.replace(/`/g, '``').replace(/\$/g, '`$');
    
    const script = `
      $content = @"
${escapedContent}
"@
      $content | Out-File -FilePath "${escapedPath}" -Encoding UTF8
      Write-Output "SUCCESS"
    `;
    
    const result = await powershellService.execute(script, 30000);
    return result.success && result.stdout.includes('SUCCESS');
  }

  /**
   * Get compliance statistics
   */
  getComplianceStats(): { total: number; compliant: number; open: number; notChecked: number; notApplicable: number; error: number; rate: number } {
    const rules = this.getAllRules();
    const stats = {
      total: rules.length,
      compliant: rules.filter(r => r.status === 'Compliant').length,
      open: rules.filter(r => r.status === 'Open').length,
      notChecked: rules.filter(r => r.status === 'Not Checked').length,
      notApplicable: rules.filter(r => r.status === 'Not Applicable').length,
      error: rules.filter(r => r.status === 'Error').length,
      rate: 0
    };
    
    const checkable = stats.total - stats.notApplicable - stats.notChecked - stats.error;
    stats.rate = checkable > 0 ? Math.round((stats.compliant / checkable) * 100) : 0;
    
    return stats;
  }
}

export const stigService = new StigService();
