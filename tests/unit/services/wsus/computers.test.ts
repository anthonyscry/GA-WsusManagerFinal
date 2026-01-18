/**
 * Unit Tests for WSUS Computers Service
 * Tests getComputers() and getStats() functions
 */

import type { PowerShellResult } from '../../../../types';
import { HealthStatus } from '../../../../types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();

jest.mock('../../../../services/powershellService', () => ({
  powershellService: {
    execute: mockExecute,
    checkModule: jest.fn(),
    importModule: jest.fn(),
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
import { getComputers, getStats } from '../../../../services/wsus/computers';

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

describe('WSUS Computers Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // getComputers() Tests
  // =========================================================================
  describe('getComputers()', () => {
    
    describe('successful responses', () => {
      it('should parse single computer response correctly', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({
            Name: 'PC001.corp.local',
            IPAddress: '192.168.1.100',
            OS: 'Windows 10 Pro',
            Status: 'Healthy',
            LastSync: '2024-01-15 10:30',
            UpdatesNeeded: 5,
            UpdatesInstalled: 120,
            TargetGroup: 'Workstations'
          })
        );

        const computers = await getComputers();
        
        expect(computers).toHaveLength(1);
        expect(computers[0]).toEqual({
          id: '1',
          name: 'PC001.corp.local',
          ipAddress: '192.168.1.100',
          os: 'Windows 10 Pro',
          status: HealthStatus.HEALTHY,
          lastSync: '2024-01-15 10:30',
          updatesNeeded: 5,
          updatesInstalled: 120,
          targetGroup: 'Workstations'
        });
      });

      it('should parse array of multiple computers', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult([
            { Name: 'PC001', IPAddress: '192.168.1.1', OS: 'Win10', Status: 'Healthy', LastSync: '2024-01-15', UpdatesNeeded: 0, UpdatesInstalled: 50, TargetGroup: 'Group1' },
            { Name: 'PC002', IPAddress: '192.168.1.2', OS: 'Win11', Status: 'Warning', LastSync: '2024-01-10', UpdatesNeeded: 5, UpdatesInstalled: 45, TargetGroup: 'Group1' },
            { Name: 'SVR001', IPAddress: '192.168.1.10', OS: 'Server2022', Status: 'Critical', LastSync: '2023-12-01', UpdatesNeeded: 20, UpdatesInstalled: 30, TargetGroup: 'Servers' },
          ])
        );

        const computers = await getComputers();
        
        expect(computers).toHaveLength(3);
        expect(computers[0].id).toBe('1');
        expect(computers[1].id).toBe('2');
        expect(computers[2].id).toBe('3');
        expect(computers[0].status).toBe(HealthStatus.HEALTHY);
        expect(computers[1].status).toBe(HealthStatus.WARNING);
        expect(computers[2].status).toBe(HealthStatus.CRITICAL);
      });

      it('should handle empty array response', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult([])
        );

        const computers = await getComputers();
        expect(computers).toEqual([]);
      });
    });

    describe('health status mapping', () => {
      const statusTestCases = [
        { input: 'Healthy', expected: HealthStatus.HEALTHY },
        { input: 'healthy', expected: HealthStatus.HEALTHY },
        { input: 'HEALTHY', expected: HealthStatus.HEALTHY },
        { input: 'Warning', expected: HealthStatus.WARNING },
        { input: 'warning', expected: HealthStatus.WARNING },
        { input: 'Critical', expected: HealthStatus.CRITICAL },
        { input: 'critical', expected: HealthStatus.CRITICAL },
        { input: 'Unknown', expected: HealthStatus.UNKNOWN },
        { input: '', expected: HealthStatus.UNKNOWN },
        { input: 'InvalidStatus', expected: HealthStatus.UNKNOWN },
      ];

      test.each(statusTestCases)(
        'should map status "$input" to $expected',
        async ({ input, expected }) => {
          mockExecute.mockResolvedValue(
            createJsonResult({ Name: 'PC', Status: input })
          );

          const computers = await getComputers();
          expect(computers[0].status).toBe(expected);
        }
      );
    });

    describe('missing/null field handling', () => {
      it('should use defaults for missing fields', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({
            Name: 'PC001',
            // All other fields missing
          })
        );

        const computers = await getComputers();
        
        expect(computers[0]).toEqual({
          id: '1',
          name: 'PC001',
          ipAddress: '0.0.0.0',
          os: 'Unknown OS',
          status: HealthStatus.UNKNOWN,
          lastSync: 'Never',
          updatesNeeded: 0,
          updatesInstalled: 0,
          targetGroup: 'Unassigned Computers'
        });
      });

      it('should handle null/undefined values gracefully', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({
            Name: null,
            IPAddress: undefined,
            Status: null,
          })
        );

        const computers = await getComputers();
        expect(computers[0].name).toBe('Unknown');
        expect(computers[0].ipAddress).toBe('0.0.0.0');
        expect(computers[0].status).toBe(HealthStatus.UNKNOWN);
      });
    });

    describe('error handling', () => {
      it('should return empty array on PowerShell failure', async () => {
        mockExecute.mockResolvedValue(
          createFailureResult('Get-WsusComputer : WSUS server not found')
        );

        const computers = await getComputers();
        expect(computers).toEqual([]);
      });

      it('should return empty array on malformed JSON', async () => {
        mockExecute.mockResolvedValue(
          createSuccessResult('this is not { valid json')
        );

        const computers = await getComputers();
        expect(computers).toEqual([]);
      });

      it('should return empty array when execute throws', async () => {
        mockExecute.mockRejectedValue(
          new Error('Network timeout')
        );

        const computers = await getComputers();
        expect(computers).toEqual([]);
      });

      it('should return empty array on empty stdout', async () => {
        mockExecute.mockResolvedValue(
          createSuccessResult('')
        );

        const computers = await getComputers();
        expect(computers).toEqual([]);
      });
    });
  });

  // =========================================================================
  // getStats() Tests
  // =========================================================================
  describe('getStats()', () => {
    
    describe('successful responses', () => {
      it('should combine WSUS stats with disk info', async () => {
        // First call: WSUS stats
        mockExecute
          .mockResolvedValueOnce(createJsonResult({
            TotalComputers: 100,
            HealthyComputers: 85,
            WarningComputers: 10,
            CriticalComputers: 5,
            TotalUpdates: 2500,
            SecurityUpdatesCount: 350,
            WsusServiceStatus: 'Running',
            SqlServiceStatus: 'Running',
            IISServiceStatus: 'Running'
          }))
          // Second call: Disk info
          .mockResolvedValueOnce(createJsonResult({ FreeGB: 250.75 }));

        const stats = await getStats();
        
        expect(stats).not.toBeNull();
        expect(stats!.totalComputers).toBe(100);
        expect(stats!.healthyComputers).toBe(85);
        expect(stats!.warningComputers).toBe(10);
        expect(stats!.criticalComputers).toBe(5);
        expect(stats!.totalUpdates).toBe(2500);
        expect(stats!.securityUpdatesCount).toBe(350);
        expect(stats!.diskFreeGB).toBe(250.75);
        expect(stats!.isInstalled).toBe(true);
      });

      it('should map service statuses correctly', async () => {
        mockExecute
          .mockResolvedValueOnce(createJsonResult({
            TotalComputers: 10,
            WsusServiceStatus: 'Running',
            SqlServiceStatus: 'Stopped',
            IISServiceStatus: 'Starting'
          }))
          .mockResolvedValueOnce(createJsonResult({ FreeGB: 100 }));

        const stats = await getStats();
        
        expect(stats!.services).toHaveLength(3);
        expect(stats!.services[0].status).toBe('Running');
        expect(stats!.services[1].status).toBe('Stopped');
        expect(stats!.services[2].status).toBe('Pending'); // 'Starting' maps to Pending
      });
    });

    describe('error handling', () => {
      it('should return null on WSUS stats failure', async () => {
        mockExecute.mockResolvedValue(
          createFailureResult('WSUS service unavailable')
        );

        const stats = await getStats();
        expect(stats).toBeNull();
      });

      it('should handle disk query failure gracefully', async () => {
        mockExecute
          .mockResolvedValueOnce(createJsonResult({ TotalComputers: 50 }))
          .mockResolvedValueOnce(createFailureResult('Access denied'));

        const stats = await getStats();
        
        expect(stats).not.toBeNull();
        expect(stats!.diskFreeGB).toBe(0); // Default on failure
      });

      it('should return null on malformed JSON', async () => {
        mockExecute.mockResolvedValue(
          createSuccessResult('{{invalid json')
        );

        const stats = await getStats();
        expect(stats).toBeNull();
      });
    });

    describe('default values', () => {
      it('should use defaults for missing numeric fields', async () => {
        mockExecute
          .mockResolvedValueOnce(createJsonResult({}))
          .mockResolvedValueOnce(createJsonResult({}));

        const stats = await getStats();
        
        expect(stats!.totalComputers).toBe(0);
        expect(stats!.healthyComputers).toBe(0);
        expect(stats!.totalUpdates).toBe(0);
        expect(stats!.diskFreeGB).toBe(0);
      });
    });
  });
});
