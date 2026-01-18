/**
 * Unit Tests for WSUS Sync Service
 * Tests syncNow() and getSyncStatus() functions
 */

import type { PowerShellResult } from '../../../../types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();

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

// Import after mocking
import { syncNow, getSyncStatus } from '../../../../services/wsus/sync';

// Helper functions
function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

describe('WSUS Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // syncNow() Tests
  // =========================================================================
  describe('syncNow()', () => {
    it('should return success when sync starts successfully', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('[SYNC] Starting...\n{"Success":true,"Message":"Synchronization started"}')
      );

      const result = await syncNow();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Synchronization started');
    });

    it('should return success when sync already in progress', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('[SYNC] Already running\n{"Success":true,"Message":"Sync already in progress"}')
      );

      const result = await syncNow();
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Sync already in progress');
    });

    it('should return failure on PowerShell error', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('WSUS server not found')
      );

      const result = await syncNow();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to start synchronization');
    });

    it('should return failure when JSON parsing fails', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('[SYNC] No JSON output')
      );

      const result = await syncNow();
      
      expect(result.success).toBe(false);
    });

    it('should handle exceptions gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Network timeout'));

      const result = await syncNow();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Network timeout');
    });

    it('should use appropriate timeout (60 seconds)', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Success":true,"Message":"OK"}')
      );

      await syncNow();
      
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), 60000);
    });
  });

  // =========================================================================
  // getSyncStatus() Tests
  // =========================================================================
  describe('getSyncStatus()', () => {
    it('should return sync status when successful', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(JSON.stringify({
          Status: 'NotProcessing',
          LastSyncTime: '2024-01-15 06:00:00',
          LastSyncResult: 'Succeeded',
          NextSyncTime: '2024-01-16 06:00:00'
        }))
      );

      const status = await getSyncStatus();
      
      expect(status.status).toBe('NotProcessing');
      expect(status.lastSyncTime).toBe('2024-01-15 06:00:00');
      expect(status.lastSyncResult).toBe('Succeeded');
      expect(status.nextSyncTime).toBe('2024-01-16 06:00:00');
    });

    it('should return Running status during sync', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(JSON.stringify({
          Status: 'Running',
          LastSyncTime: '2024-01-15 06:00:00',
          LastSyncResult: 'InProgress',
          NextSyncTime: 'Not scheduled'
        }))
      );

      const status = await getSyncStatus();
      
      expect(status.status).toBe('Running');
      expect(status.lastSyncResult).toBe('InProgress');
    });

    it('should return default status on failure', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('WSUS unavailable')
      );

      const status = await getSyncStatus();
      
      expect(status.status).toBe('Unknown');
      expect(status.lastSyncTime).toBe('Never');
      expect(status.lastSyncResult).toBe('Unknown');
      expect(status.nextSyncTime).toBe('Not scheduled');
    });

    it('should return default status on malformed JSON', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('not valid json')
      );

      const status = await getSyncStatus();
      
      expect(status.status).toBe('Unknown');
    });

    it('should handle exceptions and return error status', async () => {
      mockExecute.mockRejectedValue(new Error('Connection refused'));

      const status = await getSyncStatus();
      
      expect(status.status).toBe('Error');
      expect(status.lastSyncResult).toBe('Connection refused');
    });

    it('should use appropriate timeout (15 seconds)', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Status":"NotProcessing"}')
      );

      await getSyncStatus();
      
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), 15000);
    });

    it('should handle missing fields with defaults', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(JSON.stringify({}))
      );

      const status = await getSyncStatus();
      
      expect(status.status).toBe('Unknown');
      expect(status.lastSyncTime).toBe('Never');
      expect(status.lastSyncResult).toBe('Unknown');
      expect(status.nextSyncTime).toBe('Not scheduled');
    });
  });
});
