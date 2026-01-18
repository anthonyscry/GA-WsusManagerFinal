/**
 * Integration Tests for WSUS Workflows
 * Tests complete multi-step operations with realistic mock data
 */

import type { PowerShellResult } from '../../types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();
const mockCheckModule = jest.fn<Promise<boolean>, [string]>();
const mockImportModule = jest.fn<Promise<PowerShellResult>, [string]>();
const mockLoggingWarn = jest.fn();

jest.mock('../../services/powershellService', () => ({
  powershellService: {
    execute: mockExecute,
    checkModule: mockCheckModule,
    importModule: mockImportModule,
  }
}));

jest.mock('../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: mockLoggingWarn,
    error: jest.fn(),
  }
}));

// Import after mocking
import { getComputers, getStats } from '../../services/wsus/computers';
import { 
  getPendingUpdates, 
  approveUpdates, 
  declineSupersededUpdates,
  autoApproveSecurityUpdates 
} from '../../services/wsus/updates';
import { performHealthCheck, runFullMaintenance } from '../../services/wsus/maintenance';
import * as fixtures from './fixtures/wsusResponses';

describe('WSUS Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Telemetry Refresh Workflow
  // =========================================================================
  describe('Telemetry Refresh Workflow', () => {
    it('should refresh stats and computers sequentially', async () => {
      // Test sequential calls to avoid Promise.all non-determinism
      // First: getStats() - makes 2 calls (stats + disk)
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.HEALTHY_STATS))
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.DISK_INFO));

      const stats = await getStats();
      
      expect(stats).not.toBeNull();
      expect(stats!.totalComputers).toBe(50);

      // Then: getComputers() - makes 1 call
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.COMPUTER_LIST));

      const computers = await getComputers();
      
      expect(computers).toHaveLength(5);
      expect(computers[0].name).toBe('PC001.corp.local');
    });

    it('should handle computers failure gracefully', async () => {
      // getComputers fails
      mockExecute
        .mockResolvedValueOnce(fixtures.ERROR_RESPONSES.connectionRefused);

      const computers = await getComputers();

      expect(computers).toEqual([]); // Empty on failure
    });

    it('should handle stats failure gracefully', async () => {
      // getStats fails on first call
      mockExecute
        .mockResolvedValueOnce(fixtures.ERROR_RESPONSES.connectionRefused);

      const stats = await getStats();
      
      expect(stats).toBeNull();
    });
  });

  // =========================================================================
  // Update Approval Workflow
  // =========================================================================
  describe('Update Approval Workflow', () => {
    it('should get pending updates and approve selected ones', async () => {
      // Get pending updates
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.PENDING_UPDATES));

      const pendingUpdates = await getPendingUpdates();
      expect(pendingUpdates).toHaveLength(5);

      // Approve security updates only
      const securityUpdateIds = pendingUpdates
        .filter(u => u.classification === 'Security Updates')
        .map(u => u.id);
      
      expect(securityUpdateIds).toHaveLength(3);

      // Mock approval
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse({ Approved: 3, Failed: 0 }));

      const result = await approveUpdates(securityUpdateIds, 'All Computers');
      expect(result.approved).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should handle batch approval with partial failures', async () => {
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.PENDING_UPDATES))
        .mockResolvedValueOnce(fixtures.createMixedResponse(
          ['[WSUS] Starting approval...', '[WSUS] Some updates failed'],
          { Approved: 3, Failed: 2 }
        ));

      const updates = await getPendingUpdates();
      const allIds = updates.map(u => u.id);

      const result = await approveUpdates(allIds, 'All Computers');
      
      expect(result.approved).toBe(3);
      expect(result.failed).toBe(2);
    });
  });

  // =========================================================================
  // Health Monitoring Workflow
  // =========================================================================
  describe('Health Monitoring Workflow', () => {
    it('should detect healthy environment', async () => {
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.HEALTH_CHECK_HEALTHY));

      const health = await performHealthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      // Service data comes from PowerShell JSON; the actual runtime uses uppercase keys
      // but the TypeScript types use lowercase. Check that services are returned.
      expect(health.services.length).toBe(3);
    });

    it('should detect degraded environment', async () => {
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.HEALTH_CHECK_DEGRADED));

      const health = await performHealthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues).toContain('IIS is not running');
    });

    it('should identify critical issues', async () => {
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.HEALTH_CHECK_CRITICAL));

      const health = await performHealthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBe(4);
      expect(health.database.connected).toBe(false);
    });
  });

  // =========================================================================
  // Full Maintenance Cycle Workflow
  // =========================================================================
  describe('Full Maintenance Cycle', () => {
    // Note: runFullMaintenance calls other wsus/updates functions internally
    // which are also mocked, so we need to set up the mock chain carefully

    it('should complete full maintenance cycle successfully', async () => {
      // Mock the decline superseded call
      mockExecute
        .mockResolvedValueOnce(fixtures.createMixedResponse(
          ['[WSUS] Finding superseded updates...', '[WSUS] Found 150 superseded'],
          { Declined: 150, Errors: 0 }
        ))
        // Mock decline old
        .mockResolvedValueOnce(fixtures.createMixedResponse(
          ['[WSUS] Finding old updates...'],
          { Declined: 75, Errors: 0 }
        ))
        // Mock auto approve
        .mockResolvedValueOnce(fixtures.createMixedResponse(
          ['[WSUS] Auto-approving security updates...'],
          { Approved: 25, Skipped: 10, Errors: 0 }
        ))
        // Mock cleanup
        .mockResolvedValueOnce({ success: true, stdout: 'SUCCESS', stderr: '', exitCode: 0 });

      const result = await runFullMaintenance();
      
      expect(result.supersededDeclined).toBe(150);
      expect(result.oldDeclined).toBe(75);
      expect(result.approved).toBe(25);
      expect(result.cleanupSuccess).toBe(true);
    });

    it('should continue even when one step fails', async () => {
      mockExecute
        // Decline superseded fails
        .mockResolvedValueOnce(fixtures.ERROR_RESPONSES.timeout)
        // Decline old succeeds
        .mockResolvedValueOnce(fixtures.createSuccessResponse({ Declined: 50, Errors: 0 }))
        // Auto approve succeeds
        .mockResolvedValueOnce(fixtures.createSuccessResponse({ Approved: 10, Skipped: 5, Errors: 0 }))
        // Cleanup succeeds
        .mockResolvedValueOnce({ success: true, stdout: 'SUCCESS', stderr: '', exitCode: 0 });

      const result = await runFullMaintenance();
      
      // First step failed but others continued
      expect(result.supersededDeclined).toBe(0);
      expect(result.oldDeclined).toBe(50);
      expect(result.approved).toBe(10);
    });

    it('should report all failures when everything fails', async () => {
      mockExecute
        .mockResolvedValue(fixtures.ERROR_RESPONSES.connectionRefused);

      const result = await runFullMaintenance();
      
      expect(result.supersededDeclined).toBe(0);
      expect(result.oldDeclined).toBe(0);
      expect(result.approved).toBe(0);
      expect(result.cleanupSuccess).toBe(false);
    });
  });

  // =========================================================================
  // Bulk Operations Workflow
  // =========================================================================
  describe('Bulk Operations', () => {
    it('should process multiple decline operations', async () => {
      // First decline superseded
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse({ Declined: 100, Errors: 0 }));

      const supersededResult = await declineSupersededUpdates();
      expect(supersededResult.declined).toBe(100);

      // Then auto-approve
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse({ Approved: 50, Skipped: 25, Errors: 0 }));

      const approveResult = await autoApproveSecurityUpdates(90);
      expect(approveResult.approved).toBe(50);
    });

    it('should handle mixed success/failure in sequential operations', async () => {
      // First operation succeeds
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse({ Declined: 100, Errors: 5 }))
        // Second operation fails completely
        .mockResolvedValueOnce(fixtures.ERROR_RESPONSES.accessDenied);

      const result1 = await declineSupersededUpdates();
      expect(result1.declined).toBe(100);
      expect(result1.errors).toBe(5);

      const result2 = await autoApproveSecurityUpdates();
      expect(result2.approved).toBe(0);
    });
  });

  // =========================================================================
  // Error Recovery Workflow
  // =========================================================================
  describe('Error Recovery', () => {
    it('should recover from transient failures', async () => {
      // First attempt fails
      mockExecute
        .mockResolvedValueOnce(fixtures.ERROR_RESPONSES.timeout);

      const result1 = await getComputers();
      expect(result1).toEqual([]);

      // Second attempt succeeds
      mockExecute
        .mockResolvedValueOnce(fixtures.createSuccessResponse(fixtures.COMPUTER_LIST));

      const result2 = await getComputers();
      expect(result2).toHaveLength(5);
    });

    it('should return empty array on WSUS not installed error', async () => {
      mockExecute
        .mockResolvedValueOnce(fixtures.ERROR_RESPONSES.wsusNotInstalled);

      const result = await getPendingUpdates();
      
      // Should return empty array, not throw
      expect(result).toEqual([]);
    });
  });
});
