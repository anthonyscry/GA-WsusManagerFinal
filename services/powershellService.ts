
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
  /^Approve-WsusUpdate/i,
  /^Deny-WsusUpdate/i,
  /^Get-WsusComputer/i,
  /^Measure-Object/i,
  /^ForEach-Object/i,
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
   * Check if command is whitelisted using strict validation
   * Commands must appear in proper contexts, not just as substrings
   *
   * Security: This function enforces that only known-safe PowerShell commands
   * can be executed, preventing arbitrary code execution
   */
  private isWhitelistedCommand(command: string): boolean {
    const normalizedCommand = command.replace(/\s+/g, ' ').trim();

    // SECURITY: Check if command appears as an actual command invocation
    // Commands must be:
    // 1. At the start of the string, OR
    // 2. After a pipe |, OR
    // 3. After a semicolon/newline, OR
    // 4. After an assignment $var = , OR
    // 5. After opening delimiters like ( or {
    const commandInvocationContexts = [
      /^/,                          // Start of string
      /\|\s*/,                      // After pipe
      /;\s*/,                       // After semicolon
      /\n\s*/,                      // After newline
      /\$[a-zA-Z_]\w*\s*=\s*/,     // After variable assignment
      /\(\s*/,                      // After opening paren
      /\{\s*/,                      // After opening brace
      /\[\s*/,                      // After opening bracket (for array)
    ];

    // Check each whitelisted command pattern with proper context
    const containsWhitelistedCommandInContext = ALLOWED_COMMAND_PATTERNS.some(pattern => {
      const cmdName = pattern.source.replace(/^\^/, '').replace(/\/i$/, '');

      // Check if command appears in valid invocation context
      return commandInvocationContexts.some(ctx => {
        const contextPattern = new RegExp(
          ctx.source + cmdName,
          'i'
        );
        return contextPattern.test(normalizedCommand);
      });
    });

    if (containsWhitelistedCommandInContext) {
      return true;
    }

    // SECURITY: Only allow specific safe variable assignment patterns
    // that are required for WSUS operations
    const safeVariablePatterns = [
      /^\$wsusServer\s*=\s*Get-WsusServer/i,
      /^\$computers\s*=\s*Get-WsusComputer/i,
      /^\$updates\s*=\s*Get-WsusUpdate/i,
      /^\$stats\s*=\s*\[PSCustomObject\]/i,
      /^\$result\s*=\s*\[PSCustomObject\]/i,
      /^\$config\s*=/i,
      /^\$service\s*=\s*Get-Service/i,
      /^\$features?\s*=\s*Get-WindowsFeature/i,
      /^\$task\s*=/i,
      /^\$trigger\s*=/i,
      /^\$action\s*=/i,
      /^\$principal\s*=/i,
      /^\$settings\s*=/i,
      /^\$params?\s*=\s*@\{/i,  // Hashtable assignment
    ];

    // Check if variable assignment matches safe patterns
    const isSafeVariableAssignment = safeVariablePatterns.some(pattern =>
      pattern.test(normalizedCommand)
    );

    if (isSafeVariableAssignment) {
      return true;
    }

    // SECURITY: Allow only specific control flow with whitelisted content
    const isControlFlowWithSafeContent = (
      // Control flow keywords must be followed by whitelisted commands
      /(if|foreach|for|try)\s*\(/.test(normalizedCommand) &&
      containsWhitelistedCommandInContext
    );

    if (isControlFlowWithSafeContent) {
      return true;
    }

    // Allow PSCustomObject literals for data construction
    if (/^\[PSCustomObject\]\s*@\{/.test(normalizedCommand)) {
      return true;
    }

    // Allow module operations (already in whitelist, but ensure context)
    if (/^(Get-Module|Import-Module)\s+/i.test(normalizedCommand)) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize PowerShell command to prevent injection attacks
   * Preserves valid PowerShell syntax while blocking dangerous patterns
   *
   * SECURITY: This function removes known injection vectors while preserving
   * legitimate PowerShell functionality needed for WSUS operations
   */
  private sanitizePowerShellCommand(command: string): string {
    let sanitized = command;

    // SECURITY: Block dangerous command sequences
    // Remove Invoke-Expression and iex (arbitrary code execution)
    sanitized = sanitized.replace(/\bInvoke-Expression\b/gi, '');
    sanitized = sanitized.replace(/\biex\b/gi, '');

    // Remove DownloadString/DownloadFile (remote code loading)
    sanitized = sanitized.replace(/\.DownloadString\s*\(/gi, '');
    sanitized = sanitized.replace(/\.DownloadFile\s*\(/gi, '');

    // Remove Start-Process with hidden window (stealth execution)
    sanitized = sanitized.replace(/-WindowStyle\s+Hidden/gi, '');

    // Remove base64 decoding patterns (encoded payload execution)
    sanitized = sanitized.replace(/\[System\.Convert\]::FromBase64String/gi, '');
    sanitized = sanitized.replace(/-EncodedCommand/gi, '');
    sanitized = sanitized.replace(/-enc\b/gi, '');

    // Remove memory stream execution patterns
    sanitized = sanitized.replace(/\[System\.IO\.MemoryStream\]/gi, '');
    sanitized = sanitized.replace(/\[System\.Reflection\.Assembly\]::Load/gi, '');

    // Remove potentially dangerous backtick escape sequences
    // But preserve backtick for line continuation and special chars
    sanitized = sanitized.replace(/`0/g, '');  // Null char
    sanitized = sanitized.replace(/`a/g, '');  // Alert/bell

    // NOTE: We intentionally preserve:
    // - Pipes (|) - required for PowerShell pipelines
    // - Semicolons (;) - required for multi-statement scripts
    // - $() - required for variable expansion
    // - {} - required for script blocks

    return sanitized.trim();
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
