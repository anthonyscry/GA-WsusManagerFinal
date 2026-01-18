/**
 * Unit Tests for STIG Scanner Service
 * Tests directory scanning and XCCDF file discovery
 */

import type { PowerShellResult } from '../../../../types';
import type { StigConfig, StigBenchmark } from '../../../../services/stig/types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();
const mockParseXccdfFile = jest.fn<Promise<StigBenchmark | null>, [string]>();

jest.mock('../../../../services/powershellService', () => ({
  powershellService: {
    execute: mockExecute,
  }
}));

jest.mock('../../../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

jest.mock('../../../../services/stig/parser', () => ({
  parseXccdfFile: mockParseXccdfFile,
}));

// Import after mocking
import { scanDirectory } from '../../../../services/stig/scanner';

// Helper functions
function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

function createJsonResult<T>(data: T): PowerShellResult {
  return createSuccessResult(JSON.stringify(data));
}

// Factory for test config
function createTestConfig(overrides: Partial<StigConfig> = {}): StigConfig {
  return {
    stigDirectory: 'C:/STIGs',
    autoScanOnStartup: false,
    ...overrides,
  };
}

// Factory for test benchmark
function createTestBenchmark(overrides: Partial<StigBenchmark> = {}): StigBenchmark {
  return {
    id: 'test-benchmark',
    title: 'Test Benchmark',
    version: 'V1R1',
    releaseDate: '2024-01-01',
    description: 'Test benchmark',
    fileName: 'C:/STIGs/test.xml',
    ruleCount: 5,
    rules: [],
    ...overrides,
  };
}

describe('STIG Scanner Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // scanDirectory() Tests
  // =========================================================================
  describe('scanDirectory()', () => {
    
    describe('file discovery', () => {
      it('should find and parse single STIG file', async () => {
        const config = createTestConfig();
        const benchmark = createTestBenchmark({ title: 'Windows Server 2022' });
        
        mockExecute.mockResolvedValue(createJsonResult(['C:/STIGs/windows_server.xml']));
        mockParseXccdfFile.mockResolvedValue(benchmark);
        
        const results = await scanDirectory(config);
        
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Windows Server 2022');
        expect(mockParseXccdfFile).toHaveBeenCalledWith('C:/STIGs/windows_server.xml');
      });

      it('should find and parse multiple STIG files', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createJsonResult([
          'C:/STIGs/windows_server.xml',
          'C:/STIGs/windows_client.xml',
          'C:/STIGs/sql_server.xml',
        ]));
        
        mockParseXccdfFile
          .mockResolvedValueOnce(createTestBenchmark({ id: 'ws', title: 'Windows Server' }))
          .mockResolvedValueOnce(createTestBenchmark({ id: 'wc', title: 'Windows Client' }))
          .mockResolvedValueOnce(createTestBenchmark({ id: 'sql', title: 'SQL Server' }));
        
        const results = await scanDirectory(config);
        
        expect(results).toHaveLength(3);
        expect(mockParseXccdfFile).toHaveBeenCalledTimes(3);
      });

      it('should handle single file response (non-array JSON)', async () => {
        const config = createTestConfig();
        
        // PowerShell returns single string instead of array for single file
        mockExecute.mockResolvedValue(createJsonResult('C:/STIGs/single.xml'));
        mockParseXccdfFile.mockResolvedValue(createTestBenchmark());
        
        const results = await scanDirectory(config);
        
        expect(results).toHaveLength(1);
      });

      it('should return empty array when directory is empty', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createJsonResult([]));
        
        const results = await scanDirectory(config);
        
        expect(results).toEqual([]);
        expect(mockParseXccdfFile).not.toHaveBeenCalled();
      });

      it('should return empty array when directory returns "[]" string', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createSuccessResult('[]'));
        
        const results = await scanDirectory(config);
        
        expect(results).toEqual([]);
      });
    });

    describe('callback handling', () => {
      it('should call onBenchmarkLoaded for each parsed benchmark', async () => {
        const config = createTestConfig();
        const onLoaded = jest.fn();
        
        mockExecute.mockResolvedValue(createJsonResult([
          'C:/STIGs/file1.xml',
          'C:/STIGs/file2.xml',
        ]));
        
        const benchmark1 = createTestBenchmark({ id: 'b1' });
        const benchmark2 = createTestBenchmark({ id: 'b2' });
        
        mockParseXccdfFile
          .mockResolvedValueOnce(benchmark1)
          .mockResolvedValueOnce(benchmark2);
        
        await scanDirectory(config, onLoaded);
        
        expect(onLoaded).toHaveBeenCalledTimes(2);
        expect(onLoaded).toHaveBeenCalledWith(benchmark1);
        expect(onLoaded).toHaveBeenCalledWith(benchmark2);
      });

      it('should not call callback when parse returns null', async () => {
        const config = createTestConfig();
        const onLoaded = jest.fn();
        
        mockExecute.mockResolvedValue(createJsonResult(['C:/STIGs/invalid.xml']));
        mockParseXccdfFile.mockResolvedValue(null);
        
        await scanDirectory(config, onLoaded);
        
        expect(onLoaded).not.toHaveBeenCalled();
      });

      it('should work without callback provided', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createJsonResult(['C:/STIGs/test.xml']));
        mockParseXccdfFile.mockResolvedValue(createTestBenchmark());
        
        // Should not throw
        const results = await scanDirectory(config);
        expect(results).toHaveLength(1);
      });
    });

    describe('error handling', () => {
      it('should return empty array on PowerShell failure', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createFailureResult('Access denied'));
        
        const results = await scanDirectory(config);
        
        expect(results).toEqual([]);
      });

      it('should skip files that fail to parse', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createJsonResult([
          'C:/STIGs/valid.xml',
          'C:/STIGs/invalid.xml',
          'C:/STIGs/valid2.xml',
        ]));
        
        mockParseXccdfFile
          .mockResolvedValueOnce(createTestBenchmark({ id: 'valid1' }))
          .mockResolvedValueOnce(null) // Parse failure
          .mockResolvedValueOnce(createTestBenchmark({ id: 'valid2' }));
        
        const results = await scanDirectory(config);
        
        expect(results).toHaveLength(2);
        expect(results[0].id).toBe('valid1');
        expect(results[1].id).toBe('valid2');
      });

      it('should handle parse exceptions gracefully', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createJsonResult([
          'C:/STIGs/throws.xml',
          'C:/STIGs/valid.xml',
        ]));
        
        mockParseXccdfFile
          .mockRejectedValueOnce(new Error('Parse error'))
          .mockResolvedValueOnce(createTestBenchmark({ id: 'valid' }));
        
        const results = await scanDirectory(config);
        
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('valid');
      });

      it('should return empty array on malformed JSON response', async () => {
        const config = createTestConfig();
        
        mockExecute.mockResolvedValue(createSuccessResult('not valid json {'));
        
        const results = await scanDirectory(config);
        
        expect(results).toEqual([]);
      });
    });

    describe('path handling', () => {
      it('should escape backslashes in directory path', async () => {
        const config = createTestConfig({ stigDirectory: 'C:\\STIGs\\Windows' });
        
        mockExecute.mockResolvedValue(createJsonResult([]));
        
        await scanDirectory(config);
        
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('C:\\\\STIGs\\\\Windows'),
          30000
        );
      });

      it('should handle forward slashes in path', async () => {
        const config = createTestConfig({ stigDirectory: 'C:/STIGs/Windows' });
        
        mockExecute.mockResolvedValue(createJsonResult([]));
        
        await scanDirectory(config);
        
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('C:/STIGs/Windows'),
          30000
        );
      });
    });
  });
});
