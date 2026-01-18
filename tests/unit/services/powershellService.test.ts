/**
 * Unit Tests for PowerShell Service
 * Tests the actual powershellService by mocking electronAPI
 */

import type { PowerShellResult, ElectronAPI } from '../../../types';

// Mock the types module to control getElectronAPI
jest.mock('../../../types', () => {
  const actual = jest.requireActual('../../../types');
  return {
    ...actual,
    getElectronAPI: jest.fn(),
  };
});

import { getElectronAPI } from '../../../types';
import { powershellService } from '../../../services/powershellService';

// Helper to create mock electronAPI
function createMockElectronAPI(executePowerShell: jest.Mock): ElectronAPI {
  return {
    executePowerShell,
    showOpenDialog: jest.fn(),
    showDirectoryDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    getDebugInfo: jest.fn(),
    platform: 'win32',
    isElectron: true,
    getVersion: () => '3.8.9',
  };
}

describe('PowerShellService', () => {
  let mockExecutePowerShell: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecutePowerShell = jest.fn();
    (getElectronAPI as jest.Mock).mockReturnValue(createMockElectronAPI(mockExecutePowerShell));
  });

  // =========================================================================
  // execute() Tests
  // =========================================================================
  describe('execute()', () => {
    it('should return result from electronAPI', async () => {
      const expectedResult: PowerShellResult = {
        stdout: 'Hello World',
        stderr: '',
        exitCode: 0,
        success: true,
      };
      mockExecutePowerShell.mockResolvedValue(expectedResult);

      const result = await powershellService.execute('Write-Output "Hello World"');
      
      expect(result).toEqual(expectedResult);
      expect(mockExecutePowerShell).toHaveBeenCalledWith('Write-Output "Hello World"', 30000);
    });

    it('should pass custom timeout parameter', async () => {
      mockExecutePowerShell.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, success: true });

      await powershellService.execute('Get-Process', 60000);
      
      expect(mockExecutePowerShell).toHaveBeenCalledWith('Get-Process', 60000);
    });

    it('should use default timeout of 30000ms', async () => {
      mockExecutePowerShell.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, success: true });

      await powershellService.execute('Get-Date');
      
      expect(mockExecutePowerShell).toHaveBeenCalledWith('Get-Date', 30000);
    });

    it('should handle missing electronAPI gracefully', async () => {
      (getElectronAPI as jest.Mock).mockReturnValue(null);

      const result = await powershellService.execute('Get-Process');
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('not available');
      expect(result.exitCode).toBe(1);
    });

    it('should catch and wrap errors from electronAPI', async () => {
      mockExecutePowerShell.mockRejectedValue(new Error('IPC channel closed'));

      const result = await powershellService.execute('Get-Process');
      
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('IPC channel closed');
      expect(result.exitCode).toBe(1);
    });

    it('should handle errors without message property', async () => {
      mockExecutePowerShell.mockRejectedValue({ code: 'UNKNOWN' });

      const result = await powershellService.execute('Get-Process');
      
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Unknown error executing PowerShell');
    });
  });

  // =========================================================================
  // executeScript() Tests
  // =========================================================================
  describe('executeScript()', () => {
    it('should execute script with path', async () => {
      mockExecutePowerShell.mockResolvedValue({ stdout: 'Script output', stderr: '', exitCode: 0, success: true });

      const result = await powershellService.executeScript('C:\\Scripts\\test.ps1');
      
      expect(result.success).toBe(true);
      expect(mockExecutePowerShell).toHaveBeenCalledWith(
        expect.stringContaining('C:\\Scripts\\test.ps1'),
        30000
      );
    });

    it('should reject paths over 500 characters', async () => {
      const longPath = 'C:\\' + 'a'.repeat(500) + '.ps1';
      
      const result = await powershellService.executeScript(longPath);
      
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Invalid script path');
      expect(mockExecutePowerShell).not.toHaveBeenCalled();
    });

    it('should reject empty script path', async () => {
      const result = await powershellService.executeScript('');
      
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Invalid script path');
    });

    it('should validate parameter names (alphanumeric only)', async () => {
      mockExecutePowerShell.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, success: true });

      const result = await powershellService.executeScript('test.ps1', {
        'valid_param': 'value',
        'also-valid': 'value2',
      });
      
      expect(result.success).toBe(true);
    });

    it('should reject invalid parameter names', async () => {
      const result = await powershellService.executeScript('test.ps1', {
        'invalid;param': 'value',
      });
      
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Invalid parameter name');
    });

    it('should sanitize parameter values (remove shell characters)', async () => {
      mockExecutePowerShell.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, success: true });

      await powershellService.executeScript('test.ps1', {
        'param1': 'value;rm -rf',
        'param2': 'normal value',
      });
      
      // The semicolon should be stripped
      expect(mockExecutePowerShell).toHaveBeenCalledWith(
        expect.stringContaining('-param1 "valuerm -rf"'),
        30000
      );
    });

    it('should construct correct command with parameters', async () => {
      mockExecutePowerShell.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, success: true });

      await powershellService.executeScript('C:\\test.ps1', {
        'Server': 'localhost',
        'Port': '8530',
      });
      
      expect(mockExecutePowerShell).toHaveBeenCalledWith(
        expect.stringMatching(/& "C:\\test\.ps1" -Server "localhost" -Port "8530"/),
        30000
      );
    });
  });

  // =========================================================================
  // checkModule() Tests
  // =========================================================================
  describe('checkModule()', () => {
    it('should return true when module exists', async () => {
      mockExecutePowerShell.mockResolvedValue({
        stdout: 'ModuleType Version Name\n---------- ------- ----\nManifest   1.0.0.0 UpdateServices',
        stderr: '',
        exitCode: 0,
        success: true,
      });

      const result = await powershellService.checkModule('UpdateServices');
      
      expect(result).toBe(true);
    });

    it('should return false when module not found', async () => {
      mockExecutePowerShell.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        success: true,
      });

      const result = await powershellService.checkModule('NonExistentModule');
      
      expect(result).toBe(false);
    });

    it('should return false on execution failure', async () => {
      mockExecutePowerShell.mockResolvedValue({
        stdout: '',
        stderr: 'Error',
        exitCode: 1,
        success: false,
      });

      const result = await powershellService.checkModule('SomeModule');
      
      expect(result).toBe(false);
    });

    it('should validate module name format', async () => {
      const result = await powershellService.checkModule('Invalid;Module');
      
      expect(result).toBe(false);
      expect(mockExecutePowerShell).not.toHaveBeenCalled();
    });

    it('should accept valid module names with hyphens and underscores', async () => {
      mockExecutePowerShell.mockResolvedValue({
        stdout: 'Module found',
        stderr: '',
        exitCode: 0,
        success: true,
      });

      const result = await powershellService.checkModule('Az-Storage_v2');
      
      expect(result).toBe(true);
      expect(mockExecutePowerShell).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // importModule() Tests
  // =========================================================================
  describe('importModule()', () => {
    it('should import valid module', async () => {
      mockExecutePowerShell.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        success: true,
      });

      const result = await powershellService.importModule('UpdateServices');
      
      expect(result.success).toBe(true);
      expect(mockExecutePowerShell).toHaveBeenCalledWith(
        'Import-Module "UpdateServices" -ErrorAction SilentlyContinue',
        30000
      );
    });

    it('should reject invalid module name', async () => {
      const result = await powershellService.importModule('Invalid|Module');
      
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Invalid module name');
      expect(mockExecutePowerShell).not.toHaveBeenCalled();
    });

    it('should handle import failure', async () => {
      mockExecutePowerShell.mockResolvedValue({
        stdout: '',
        stderr: 'Module not found',
        exitCode: 1,
        success: false,
      });

      const result = await powershellService.importModule('NonExistent');
      
      expect(result.success).toBe(false);
    });

    it('should accept module names with hyphens', async () => {
      mockExecutePowerShell.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        success: true,
      });

      const result = await powershellService.importModule('PSWindowsUpdate');
      
      expect(result.success).toBe(true);
    });
  });
});
