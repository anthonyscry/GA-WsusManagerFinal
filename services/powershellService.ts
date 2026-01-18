
// PowerShell service for Electron - uses secure IPC channel via electronAPI
// SECURITY: All PowerShell execution goes through main.js IPC handler with server-side validation

import { getElectronAPI, PowerShellResult } from '../types';

class PowerShellService {
  /**
   * Execute a PowerShell command and return the result
   * Uses secure IPC channel to main process which performs server-side validation
   */
  async execute(command: string, timeout: number = 30000): Promise<PowerShellResult> {
    const electronAPI = getElectronAPI();
    
    if (!electronAPI) {
      return {
        stdout: '',
        stderr: 'PowerShell execution not available (not in Electron context)',
        exitCode: 1,
        success: false
      };
    }

    try {
      // Use secure IPC channel - server-side validation happens in main.js
      return await electronAPI.executePowerShell(command, timeout);
    } catch (error: unknown) {
      const errorObj = error as { message?: string };
      return {
        stdout: '',
        stderr: errorObj.message || 'Unknown error executing PowerShell',
        exitCode: 1,
        success: false
      };
    }
  }

  /**
   * Execute a PowerShell script file with path validation
   */
  async executeScript(scriptPath: string, parameters: Record<string, string> = {}): Promise<PowerShellResult> {
    // Validate script path
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
