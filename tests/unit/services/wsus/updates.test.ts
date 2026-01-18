/**
 * Unit Tests for WSUS Updates Service
 * Tests all update-related operations
 */

import type { PowerShellResult } from '../../../../types';

// Mock the services
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
import {
  getPendingUpdates,
  approveUpdates,
  declineUpdates,
  declineSupersededUpdates,
  declineOldUpdates,
  declineDriverUpdates,
  autoApproveSecurityUpdates
} from '../../../../services/wsus/updates';

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

describe('WSUS Updates Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // getPendingUpdates() Tests
  // =========================================================================
  describe('getPendingUpdates()', () => {
    it('should parse pending updates correctly', async () => {
      mockExecute.mockResolvedValue(
        createJsonResult([
          {
            Id: 'update-001',
            Title: 'Security Update for Windows (KB5001234)',
            Classification: 'Security Updates',
            Severity: 'Critical',
            ReleaseDate: '2024-01-10'
          },
          {
            Id: 'update-002',
            Title: 'Cumulative Update (KB5001235)',
            Classification: 'Critical Updates',
            Severity: 'Important',
            ReleaseDate: '2024-01-08'
          }
        ])
      );

      const updates = await getPendingUpdates();
      
      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({
        id: 'update-001',
        title: 'Security Update for Windows (KB5001234)',
        classification: 'Security Updates',
        severity: 'Critical',
        releaseDate: '2024-01-10'
      });
    });

    it('should filter out updates without ID', async () => {
      mockExecute.mockResolvedValue(
        createJsonResult([
          { Id: 'valid-001', Title: 'Valid Update' },
          { Title: 'Missing ID Update' },
          { Id: '', Title: 'Empty ID Update' },
          { Id: 'valid-002', Title: 'Another Valid' }
        ])
      );

      const updates = await getPendingUpdates();
      
      expect(updates).toHaveLength(2);
      expect(updates[0].id).toBe('valid-001');
      expect(updates[1].id).toBe('valid-002');
    });

    it('should return empty array on failure', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('WSUS not available')
      );

      const updates = await getPendingUpdates();
      expect(updates).toEqual([]);
    });

    it('should handle single update (non-array) response', async () => {
      mockExecute.mockResolvedValue(
        createJsonResult({
          Id: 'single-001',
          Title: 'Single Update',
          Classification: 'Updates',
          Severity: 'Moderate',
          ReleaseDate: '2024-01-01'
        })
      );

      const updates = await getPendingUpdates();
      expect(updates).toHaveLength(1);
      expect(updates[0].id).toBe('single-001');
    });

    it('should use default values for missing fields', async () => {
      mockExecute.mockResolvedValue(
        createJsonResult([{ Id: 'test-id' }])
      );

      const updates = await getPendingUpdates();
      expect(updates[0]).toEqual({
        id: 'test-id',
        title: '',
        classification: '',
        severity: 'Unknown',
        releaseDate: ''
      });
    });
  });

  // =========================================================================
  // approveUpdates() Tests
  // =========================================================================
  describe('approveUpdates()', () => {
    it('should return approval counts on success', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('[WSUS] Approving updates...\n{"Approved":5,"Failed":1}')
      );

      const result = await approveUpdates(['id1', 'id2', 'id3', 'id4', 'id5', 'id6'], 'All Computers');
      
      expect(result).toEqual({ approved: 5, failed: 1 });
    });

    it('should handle all failures', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('Target group not found')
      );

      const result = await approveUpdates(['id1', 'id2'], 'NonExistent');
      
      expect(result).toEqual({ approved: 0, failed: 2 });
    });

    it('should extract JSON from mixed output with progress messages', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(`
[WSUS] Starting approval...
[WSUS] Processing update 1
[WSUS] Processing update 2
{"Approved":2,"Failed":0}
[WSUS] Complete
        `)
      );

      const result = await approveUpdates(['id1', 'id2'], 'All Computers');
      expect(result).toEqual({ approved: 2, failed: 0 });
    });

    it('should return zeros when JSON extraction fails', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('[WSUS] No JSON output here')
      );

      const result = await approveUpdates(['id1'], 'All Computers');
      expect(result).toEqual({ approved: 0, failed: 1 });
    });
  });

  // =========================================================================
  // declineUpdates() Tests
  // =========================================================================
  describe('declineUpdates()', () => {
    it('should return decline counts on success', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Declined":3,"Failed":0}')
      );

      const result = await declineUpdates(['id1', 'id2', 'id3']);
      
      expect(result).toEqual({ declined: 3, failed: 0 });
    });

    it('should handle partial failures', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Declined":2,"Failed":1}')
      );

      const result = await declineUpdates(['id1', 'id2', 'id3']);
      
      expect(result).toEqual({ declined: 2, failed: 1 });
    });

    it('should return all failed on complete failure', async () => {
      mockExecute.mockRejectedValue(
        new Error('Connection lost')
      );

      const result = await declineUpdates(['id1', 'id2']);
      expect(result).toEqual({ declined: 0, failed: 2 });
    });
  });

  // =========================================================================
  // declineSupersededUpdates() Tests
  // =========================================================================
  describe('declineSupersededUpdates()', () => {
    it('should decline superseded updates', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult(
          '[WSUS] Finding superseded updates...\n' +
          '[WSUS] Found 150 superseded updates to decline\n' +
          '{"Declined":150,"Errors":0}'
        )
      );

      const result = await declineSupersededUpdates();
      
      expect(result).toEqual({ declined: 150, errors: 0 });
    });

    it('should handle errors during decline', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Declined":145,"Errors":5}')
      );

      const result = await declineSupersededUpdates();
      
      expect(result).toEqual({ declined: 145, errors: 5 });
    });

    it('should return zeros on complete failure', async () => {
      mockExecute.mockRejectedValue(
        new Error('Timeout')
      );

      const result = await declineSupersededUpdates();
      
      expect(result).toEqual({ declined: 0, errors: 1 });
    });

    it('should handle empty result', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('[WSUS] No superseded updates found')
      );

      const result = await declineSupersededUpdates();
      expect(result).toEqual({ declined: 0, errors: 0 });
    });
  });

  // =========================================================================
  // declineOldUpdates() Tests
  // =========================================================================
  describe('declineOldUpdates()', () => {
    it('should decline updates older than specified days', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Declined":75,"Errors":0}')
      );

      const result = await declineOldUpdates(90);
      
      expect(result).toEqual({ declined: 75, errors: 0 });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('-90'),
        expect.any(Number)
      );
    });

    it('should use default 90 days when not specified', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Declined":50,"Errors":0}')
      );

      await declineOldUpdates();
      
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('AddDays(-90)'),
        expect.any(Number)
      );
    });

    it('should handle errors', async () => {
      mockExecute.mockRejectedValue(
        new Error('Database error')
      );

      const result = await declineOldUpdates(30);
      expect(result).toEqual({ declined: 0, errors: 1 });
    });
  });

  // =========================================================================
  // declineDriverUpdates() Tests
  // =========================================================================
  describe('declineDriverUpdates()', () => {
    it('should decline driver updates', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Declined":200,"Errors":0}')
      );

      const result = await declineDriverUpdates();
      
      expect(result).toEqual({ declined: 200, errors: 0 });
    });

    it('should handle partial errors', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Declined":195,"Errors":5}')
      );

      const result = await declineDriverUpdates();
      expect(result).toEqual({ declined: 195, errors: 5 });
    });

    it('should handle complete failure', async () => {
      mockExecute.mockRejectedValue(
        new Error('Access denied')
      );

      const result = await declineDriverUpdates();
      expect(result).toEqual({ declined: 0, errors: 1 });
    });
  });

  // =========================================================================
  // autoApproveSecurityUpdates() Tests
  // =========================================================================
  describe('autoApproveSecurityUpdates()', () => {
    it('should auto-approve security updates', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Approved":25,"Skipped":10,"Errors":0}')
      );

      const result = await autoApproveSecurityUpdates(90);
      
      expect(result).toEqual({ approved: 25, skipped: 10, errors: 0 });
    });

    it('should handle already-approved updates as skipped', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Approved":5,"Skipped":20,"Errors":0}')
      );

      const result = await autoApproveSecurityUpdates();
      
      expect(result.skipped).toBe(20);
    });

    it('should use default maxAgeDays when not specified', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Approved":10,"Skipped":5,"Errors":0}')
      );

      await autoApproveSecurityUpdates();
      
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('AddDays(-90)'),
        expect.any(Number)
      );
    });

    it('should return zeros on failure', async () => {
      mockExecute.mockResolvedValue(
        createFailureResult('Target group not found')
      );

      const result = await autoApproveSecurityUpdates();
      
      expect(result).toEqual({ approved: 0, skipped: 0, errors: 0 });
    });

    it('should handle execution errors', async () => {
      mockExecute.mockRejectedValue(
        new Error('WSUS timeout')
      );

      const result = await autoApproveSecurityUpdates();
      expect(result).toEqual({ approved: 0, skipped: 0, errors: 1 });
    });
  });
});
