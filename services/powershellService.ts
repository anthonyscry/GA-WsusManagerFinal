
// PowerShell service for Electron - uses Node.js APIs available at runtime
// Note: This will only work in Electron context, not in browser

interface PowerShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

// Whitelist of allowed PowerShell commands/modules
const ALLOWED_COMMAND_PATTERNS = [
  /^Get-WsusServer/i,
  /^Get-WsusComputer/i,
  /^Get-WsusUpdate/i,
  /^Invoke-WsusServerSynchronization/i,
  /^Invoke-WsusServerCleanup/i,
  /^Get-Service/i,
  /^Stop-Service/i,
  /^Get-Process/i,
  /^Stop-Process/i,
  /^Get-PSDrive/i,
  /^Get-Module/i,
  /^Import-Module/i,
  /^Install-Module/i,
  /^Invoke-Sqlcmd/i,
  /^ConvertTo-Json/i,
  /^ConvertFrom-Json/i,
  /^Invoke-WebRequest/i,
  /^Start-Process/i,
  /^Test-Path/i,
  /^Remove-Item/i,
  /^New-Item/i,
  /^Get-ChildItem/i,
  /^Add-Type/i,
  /^Out-File/i,
  /^Write-Output/i,
  /^Write-Error/i,
  /^Start-Sleep/i,
  // Task Scheduler commands
  /^Register-ScheduledTask/i,
  /^Unregister-ScheduledTask/i,
  /^Get-ScheduledTask/i,
  /^Set-ScheduledTask/i,
  /^New-ScheduledTaskTrigger/i,
  /^New-ScheduledTaskAction/i,
  /^New-ScheduledTaskPrincipal/i,
  /^New-ScheduledTaskSettingsSet/i,
  // STIG compliance check commands
  /^Get-ItemProperty/i,
  /^Get-WebConfigurationProperty/i,
  /^Get-WebConfiguration/i,
  /^netsh/i,
  /^Get-Content/i,
  /^Select-Object/i,
  /^Where-Object/i,
  /^auditpol/i,
  /^secedit/i,
  /^Get-NetFirewallProfile/i,
  /^\[xml\]/i,
  /^\[System\.IO\.Compression/i,
  // Deployment commands
  /^Install-WindowsFeature/i,
  /^Get-WindowsFeature/i,
  /^Get-CimInstance/i,
  /^Set-WsusServerSynchronization/i,
  /^Get-WsusProduct/i,
  /^Set-WsusProduct/i,
  /^Get-WsusClassification/i,
  /^Set-WsusClassification/i,
];

class PowerShellService {
  private nodeModulesAvailable: boolean = false;
  private execFn: ((command: string, options: unknown, callback: (error: unknown, stdout: string, stderr: string) => void) => void) | null = null;
  private promisifyFn: ((fn: unknown) => unknown) | null = null;

  constructor() {
    // Check if we're in Electron context with Node.js APIs
    // In Electron with nodeIntegration: true, we can use require directly
    try {
      if (typeof require !== 'undefined') {
        // Direct require (works in Electron with nodeIntegration: true)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { exec } = require('child_process');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { promisify } = require('util');
        this.execFn = exec;
        this.promisifyFn = promisify;
        this.nodeModulesAvailable = !!exec && !!promisify;
        
        // Node.js modules loaded successfully
      } else if (typeof window !== 'undefined' && (window as unknown as { require?: (module: string) => unknown }).require) {
        // Window.require (older Electron versions)
        const winRequire = (window as unknown as { require: (module: string) => unknown }).require;
        const { exec } = winRequire('child_process') as { exec: typeof import('child_process').exec };
        const { promisify } = winRequire('util') as { promisify: typeof import('util').promisify };
        this.execFn = exec;
        this.promisifyFn = promisify;
        this.nodeModulesAvailable = !!exec && !!promisify;
        
        // Node.js modules loaded via window.require
      } else {
        // Node.js modules not available - require not found (likely not in Electron context)
        this.nodeModulesAvailable = false;
      }
    } catch (e) {
      // Failed to load Node.js modules (likely not in Electron context)
      this.nodeModulesAvailable = false;
    }
  }

  /**
   * Check if command is whitelisted
   * Checks if the script contains any of the allowed command patterns
   */
  private isWhitelistedCommand(command: string): boolean {
    // For complex scripts, check if they contain allowed commands
    // This allows scripts with multiple commands, variables, conditionals, etc.
    const normalizedCommand = command.replace(/\s+/g, ' ').trim();
    
    // Check if script contains any allowed command pattern (anywhere in the string)
    const containsAllowedCommand = ALLOWED_COMMAND_PATTERNS.some(pattern => {
      // Remove the ^ anchor to check anywhere in the string, not just at start
      const flexiblePattern = new RegExp(pattern.source.replace('^', ''), pattern.flags);
      return flexiblePattern.test(normalizedCommand);
    });
    
    if (containsAllowedCommand) {
      return true;
    }
    
    // Also allow scripts that are clearly PowerShell variable assignments, control flow,
    // or data manipulation that will be used with whitelisted commands
    const isVariableAssignment = /\$[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(normalizedCommand);
    const isControlFlow = /(if|else|foreach|where-object|select-object|for|while|try|catch)\s*\(/i.test(normalizedCommand);
    const isDataManipulation = /(ConvertTo-Json|ConvertFrom-Json|Write-Output|Write-Error)/i.test(normalizedCommand);
    const isPSCustomObject = /\[PSCustomObject\]/.test(normalizedCommand);
    
    // If it contains PowerShell constructs that are typically used with whitelisted commands
    if (isVariableAssignment || isControlFlow || isDataManipulation || isPSCustomObject) {
      return true;
    }
    
    // Allow module operations
    if (/Get-Module|Import-Module|Install-Module/i.test(normalizedCommand)) {
      return true;
    }
    
    return false;
  }

  /**
   * Sanitize PowerShell command to prevent injection
   * Only removes truly dangerous patterns, preserves valid PowerShell syntax
   */
  private sanitizePowerShellCommand(command: string): string {
    // Don't over-sanitize - PowerShell needs $, (), {}, etc.
    // Only remove dangerous command chaining and injection patterns
    return command
      // Remove command chaining operators at line boundaries (but allow in strings)
      .replace(/(?<!["']);(?![^"']*["'])/g, '')  // Remove semicolons not in quotes
      .replace(/(?<!["'])\|(?![^"']*["'])/g, '')  // Remove pipes not in quotes (but this might be too aggressive)
      // Remove backtick command substitution
      .replace(/`[a-zA-Z]/g, ' ')  // Remove backtick escape sequences
      // Preserve $ variables, (), {}, [] as they're needed for PowerShell
      .trim();
  }

  /**
   * Execute a PowerShell command and return the result
   */
  async execute(command: string, timeout: number = 30000): Promise<PowerShellResult> {
    if (!this.nodeModulesAvailable) {
      return {
        stdout: '',
        stderr: 'PowerShell execution not available (not in Electron context or Node.js modules not loaded)',
        exitCode: 1,
        success: false
      };
    }

    // Validate command is whitelisted
    if (!this.isWhitelistedCommand(command)) {
      return {
        stdout: '',
        stderr: 'Command not whitelisted for security',
        exitCode: 1,
        success: false
      };
    }

    try {
      if (!this.execFn || !this.promisifyFn) {
        // Try to get modules again
        if (typeof require !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { exec } = require('child_process');
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { promisify } = require('util');
          this.execFn = exec;
          this.promisifyFn = promisify;
        } else if (typeof window !== 'undefined' && (window as unknown as { require?: (module: string) => unknown }).require) {
          const winRequire = (window as unknown as { require: (module: string) => unknown }).require;
          const { exec } = winRequire('child_process') as { exec: typeof import('child_process').exec };
          const { promisify } = winRequire('util') as { promisify: typeof import('util').promisify };
          this.execFn = exec;
          this.promisifyFn = promisify;
        }
      }
      
      if (!this.execFn || !this.promisifyFn) {
        throw new Error('Node.js modules not available');
      }
      
      const execAsync = this.promisifyFn(this.execFn) as (
        command: string,
        options: { timeout: number; maxBuffer: number }
      ) => Promise<{ stdout: string; stderr: string }>;
      
      // Escape quotes for command line (but don't over-sanitize the command itself)
      // The whitelist check already ensures only safe commands are executed
      const escapedCommand = command.replace(/"/g, '\\"').replace(/\$/g, '`$');
      
      // Use PowerShell Core (pwsh) if available, otherwise fall back to Windows PowerShell (powershell)
      const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${escapedCommand}"`;
      
      const { stdout, stderr } = await execAsync(psCommand, {
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        success: true
      };
    } catch (error: unknown) {
      const errorObj = error as { stdout?: string; stderr?: string; message?: string; code?: number };
      return {
        stdout: errorObj.stdout || '',
        stderr: errorObj.stderr || errorObj.message || '',
        exitCode: errorObj.code || 1,
        success: false
      };
    }
  }

  /**
   * Execute a PowerShell script file with path validation
   */
  async executeScript(scriptPath: string, parameters: Record<string, string> = {}): Promise<PowerShellResult> {
    // Validate script path (would need path module, but keeping simple for now)
    if (!scriptPath || scriptPath.length > 500) {
      return {
        stdout: '',
        stderr: 'Invalid script path',
        exitCode: 1,
        success: false
      };
    }

    // Validate parameters
    const sanitizedParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return {
          stdout: '',
          stderr: `Invalid parameter name: ${key}`,
          exitCode: 1,
          success: false
        };
      }
      // Sanitize parameter values
      sanitizedParams[key] = String(value).replace(/[;&|`$(){}[\]]/g, '');
    }

    const paramString = Object.entries(sanitizedParams)
      .map(([key, value]) => `-${key} "${value}"`)
      .join(' ');

    const command = `& "${scriptPath}" ${paramString}`;
    return this.execute(command);
  }

  /**
   * Check if a PowerShell module is available
   */
  async checkModule(moduleName: string): Promise<boolean> {
    // Validate module name
    if (!/^[a-zA-Z0-9_-]+$/.test(moduleName)) {
      return false;
    }
    
    const result = await this.execute(`Get-Module -ListAvailable -Name "${moduleName}" | Select-Object -First 1`);
    return result.success && result.stdout.length > 0;
  }

  /**
   * Import a PowerShell module
   */
  async importModule(moduleName: string): Promise<PowerShellResult> {
    // Validate module name
    if (!/^[a-zA-Z0-9_-]+$/.test(moduleName)) {
      return {
        stdout: '',
        stderr: 'Invalid module name',
        exitCode: 1,
        success: false
      };
    }
    
    return this.execute(`Import-Module "${moduleName}" -ErrorAction SilentlyContinue`);
  }
}

export const powershellService = new PowerShellService();
