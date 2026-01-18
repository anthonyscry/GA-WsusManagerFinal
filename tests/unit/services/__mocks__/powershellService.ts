/**
 * Mock PowerShell Service for Unit Tests
 * Provides helpers for creating fake PowerShell responses
 */

import type { PowerShellResult } from '../../../../types';

// Mock functions
export const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();
export const mockCheckModule = jest.fn<Promise<boolean>, [string]>();
export const mockImportModule = jest.fn<Promise<PowerShellResult>, [string]>();
export const mockExecuteScript = jest.fn<Promise<PowerShellResult>, [string, Record<string, string>?]>();

// Mock service object
export const powershellService = {
  execute: mockExecute,
  checkModule: mockCheckModule,
  importModule: mockImportModule,
  executeScript: mockExecuteScript,
};

/**
 * Create a successful PowerShell result
 */
export function createSuccessResult(stdout: string): PowerShellResult {
  return {
    success: true,
    stdout,
    stderr: '',
    exitCode: 0,
  };
}

/**
 * Create a failed PowerShell result
 */
export function createFailureResult(stderr: string, exitCode = 1): PowerShellResult {
  return {
    success: false,
    stdout: '',
    stderr,
    exitCode,
  };
}

/**
 * Create a PowerShell result with JSON data
 */
export function createJsonResult<T>(data: T): PowerShellResult {
  return createSuccessResult(JSON.stringify(data));
}

/**
 * Create a PowerShell result with mixed output (progress + JSON)
 * Simulates real WSUS output with progress messages before JSON
 */
export function createMixedOutputResult<T>(progressMessages: string[], data: T): PowerShellResult {
  const output = [...progressMessages, JSON.stringify(data)].join('\n');
  return createSuccessResult(output);
}

/**
 * Reset all mock functions
 */
export function resetMocks(): void {
  mockExecute.mockReset();
  mockCheckModule.mockReset();
  mockImportModule.mockReset();
  mockExecuteScript.mockReset();
}

/**
 * Setup default mock implementations
 */
export function setupDefaultMocks(): void {
  mockExecute.mockResolvedValue(createSuccessResult(''));
  mockCheckModule.mockResolvedValue(true);
  mockImportModule.mockResolvedValue(createSuccessResult(''));
  mockExecuteScript.mockResolvedValue(createSuccessResult(''));
}

export default powershellService;
