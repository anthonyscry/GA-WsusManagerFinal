/**
 * Unit Tests for WSUS Maintenance Service
 * Tests cleanup, configuration, health check, and full maintenance operations
 */

import type { PowerShellResult } from '../../../../types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();
const mockDeclineSupersededUpdates = jest.fn();
const mockDeclineOldUpdates = jest.fn();
const mockAutoApproveSecurityUpdates = jest.fn();

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

jest.mock('../../../../services/wsus/updates', () => ({
  declineSupersededUpdates: mockDeclineSupersededUpdates,
  declineOldUpdates: mockDeclineOldUpdates,
  autoApproveSecurityUpdates: mockAutoApproveSecurityUpdates,
}));

// Import after mocking
import {
  performCleanup,
  configureProductsAndClassifications,
  performHealthCheck,
  runFullMaintenance
} from '../../../../services/wsus/maintenance';

// Helper functions
function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

describe('WSUS Maintenance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // performCleanup() Tests
  // =========================================================================
  describe('performCleanup()', () => {
    it('should return true on successful cleanup', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('Cleanup completed\nSUCCESS')
      );

      const result = await performCleanup();
      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('Cleanup failed: Access denied')
      );

      const result = await performCleanup();
      expect(result).toBe(false);
    });

    it('should return false when SUCCESS not in output', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('Cleanup ran but no success marker')
      );

      const result = await performCleanup();
      expect(result).toBe(false);
    });

    it('should handle exceptions gracefully', async () => {
      mockExecute.mockRejectedValue(
        new Error('Timeout after 10 minutes')
      );

      const result = await performCleanup();
      expect(result).toBe(false);
    });

    it('should call execute with appropriate timeout', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('SUCCESS')
      );

      await performCleanup();
      
      // Cleanup should have a long timeout (600000ms = 10 minutes)
      expect(mockExecute).toHaveBeenCalledWith(
        expect.any(String),
        600000
      );
    });
  });

  // =========================================================================
  // configureProductsAndClassifications() Tests
  // =========================================================================
  describe('configureProductsAndClassifications()', () => {
    it('should configure with specified products', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('[WSUS] Configuration saved successfully\nSUCCESS')
      );

      const result = await configureProductsAndClassifications(['Windows 10', 'Windows 11']);
      
      expect(result).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('Windows 10'),
        expect.any(Number)
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('Windows 11'),
        expect.any(Number)
      );
    });

    it('should use default products if none specified', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('SUCCESS')
      );

      await configureProductsAndClassifications();
      
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('Windows Server'),
        expect.any(Number)
      );
    });

    it('should return false on failure', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('Configuration failed')
      );

      const result = await configureProductsAndClassifications(['Windows 10']);
      expect(result).toBe(false);
    });

    it('should handle exceptions', async () => {
      mockExecute.mockRejectedValue(
        new Error('WSUS connection lost')
      );

      const result = await configureProductsAndClassifications();
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // performHealthCheck() Tests
  // =========================================================================
  describe('performHealthCheck()', () => {
    it('should return health check results when healthy', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(JSON.stringify({
          Healthy: true,
          Services: [
            { Name: 'WSUS Service', Status: 'Running', Healthy: true },
            { Name: 'SQL Server', Status: 'Running', Healthy: true },
            { Name: 'IIS (W3SVC)', Status: 'Running', Healthy: true }
          ],
          Database: { Connected: true, SizeGB: 5.5, LastBackup: '2024-01-15 02:00' },
          Sync: { LastSync: '2024-01-15 06:00', NextSync: '2024-01-16 06:00', Status: 'NotProcessing' },
          Issues: []
        }))
      );

      const result = await performHealthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.services).toHaveLength(3);
      expect(result.database.connected).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify unhealthy services', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(JSON.stringify({
          Healthy: false,
          Services: [
            { Name: 'WSUS Service', Status: 'Stopped', Healthy: false },
            { Name: 'SQL Server', Status: 'Running', Healthy: true }
          ],
          Database: { Connected: true, SizeGB: 5.5, LastBackup: '2024-01-15' },
          Sync: { LastSync: 'Unknown', NextSync: 'Unknown', Status: 'Unknown' },
          Issues: ['WSUS Service is not running']
        }))
      );

      const result = await performHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.issues).toContain('WSUS Service is not running');
    });

    it('should detect database issues', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(JSON.stringify({
          Healthy: false,
          Services: [],
          Database: { Connected: false, SizeGB: 0, LastBackup: 'Unknown' },
          Sync: { LastSync: 'Unknown', NextSync: 'Unknown', Status: 'Unknown' },
          Issues: ['Cannot connect to SUSDB database']
        }))
      );

      const result = await performHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.database.connected).toBe(false);
      expect(result.issues).toContain('Cannot connect to SUSDB database');
    });

    it('should return default result on failure', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('Health check script failed')
      );

      const result = await performHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.issues).toContain('Health check failed to execute');
    });

    it('should handle malformed JSON', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('not valid json {{{')
      );

      const result = await performHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should handle exceptions', async () => {
      mockExecute.mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await performHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.issues).toContain('Connection refused');
    });
  });

  // =========================================================================
  // runFullMaintenance() Tests
  // =========================================================================
  describe('runFullMaintenance()', () => {
    beforeEach(() => {
      // Setup default mocks for update functions
      mockDeclineSupersededUpdates.mockResolvedValue({ declined: 100, errors: 0 });
      mockDeclineOldUpdates.mockResolvedValue({ declined: 50, errors: 0 });
      mockAutoApproveSecurityUpdates.mockResolvedValue({ approved: 25, skipped: 5, errors: 0 });
      mockExecute.mockResolvedValue(
        createSuccessResult('SUCCESS')
      );
    });

    it('should execute all maintenance steps', async () => {
      const result = await runFullMaintenance();
      
      expect(mockDeclineSupersededUpdates).toHaveBeenCalled();
      expect(mockDeclineOldUpdates).toHaveBeenCalledWith(90);
      expect(mockAutoApproveSecurityUpdates).toHaveBeenCalledWith(90);
      expect(mockExecute).toHaveBeenCalled(); // For cleanup
    });

    it('should aggregate results from all steps', async () => {
      const result = await runFullMaintenance();
      
      expect(result.supersededDeclined).toBe(100);
      expect(result.oldDeclined).toBe(50);
      expect(result.approved).toBe(25);
      expect(result.cleanupSuccess).toBe(true);
    });

    it('should continue even if one step fails', async () => {
      mockDeclineSupersededUpdates.mockResolvedValue({ declined: 0, errors: 5 });
      
      const result = await runFullMaintenance();
      
      // Other steps should still have been called
      expect(mockDeclineOldUpdates).toHaveBeenCalled();
      expect(mockAutoApproveSecurityUpdates).toHaveBeenCalled();
    });

    it('should report cleanup failure', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('Cleanup failed')
      );

      const result = await runFullMaintenance();
      
      expect(result.cleanupSuccess).toBe(false);
    });
  });
});
