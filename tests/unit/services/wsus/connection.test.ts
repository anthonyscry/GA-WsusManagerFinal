/**
 * Unit Tests for WSUS Connection Service
 * Tests connection initialization and script generation
 */

import type { PowerShellResult } from '../../../../types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();
const mockCheckModule = jest.fn<Promise<boolean>, [string]>();
const mockImportModule = jest.fn<Promise<PowerShellResult>, [string]>();

jest.mock('../../../../services/powershellService', () => ({
  powershellService: {
    execute: mockExecute,
    checkModule: mockCheckModule,
    importModule: mockImportModule,
  }
}));

jest.mock('../../../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Import after mocking
import { initialize, getConnectionScript, getConnectionConfig } from '../../../../services/wsus/connection';

// Helper functions
function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

describe('WSUS Connection Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // getConnectionScript() Tests
  // =========================================================================
  describe('getConnectionScript()', () => {
    it('should return localhost script by default', () => {
      // First initialize with defaults
      const script = getConnectionScript();
      
      expect(script).toContain('localhost');
      expect(script).toContain('8530');
    });
  });

  // =========================================================================
  // getConnectionConfig() Tests
  // =========================================================================
  describe('getConnectionConfig()', () => {
    it('should return current connection config', () => {
      const config = getConnectionConfig();
      
      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('useSsl');
    });

    it('should return a copy of config (not the original)', () => {
      const config1 = getConnectionConfig();
      const config2 = getConnectionConfig();
      
      // Should be equal values but different references
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  // =========================================================================
  // initialize() Tests
  // =========================================================================
  describe('initialize()', () => {
    it('should return true when module is available', async () => {
      mockCheckModule.mockResolvedValue(true);
      mockImportModule.mockResolvedValue(
        createSuccessResult('Module imported successfully')
      );

      const result = await initialize();
      
      expect(result).toBe(true);
      expect(mockCheckModule).toHaveBeenCalledWith('UpdateServices');
    });

    it('should return false when module is not found', async () => {
      mockCheckModule.mockResolvedValue(false);

      const result = await initialize();
      
      expect(result).toBe(false);
    });

    it('should return false on import failure', async () => {
      mockCheckModule.mockResolvedValue(true);
      mockImportModule.mockResolvedValue(
        createFailureResult('Import-Module : Module not found')
      );

      const result = await initialize();
      
      expect(result).toBe(false);
    });

    it('should accept custom server and port', async () => {
      mockCheckModule.mockResolvedValue(true);
      mockImportModule.mockResolvedValue(
        createSuccessResult('Module imported')
      );

      await initialize('wsus.corp.local', 8531, true);
      
      // After initialization, getConnectionScript should reflect new settings
      const script = getConnectionScript();
      expect(script).toContain('wsus.corp.local');
      expect(script).toContain('8531');
    });

    it('should handle exceptions gracefully', async () => {
      mockCheckModule.mockRejectedValue(
        new Error('PowerShell not available')
      );

      const result = await initialize();
      
      expect(result).toBe(false);
    });

    it('should use default parameters when none provided', async () => {
      mockCheckModule.mockResolvedValue(true);
      mockImportModule.mockResolvedValue(
        createSuccessResult('Module imported')
      );

      await initialize();
      
      expect(mockCheckModule).toHaveBeenCalledWith('UpdateServices');
      expect(mockImportModule).toHaveBeenCalledWith('UpdateServices');
    });
  });
});
