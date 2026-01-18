/**
 * Unit Tests for WSUS Air-Gap Service
 */

import type { PowerShellResult } from '../../../../types';

const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();

jest.mock('../../../../services/powershellService', () => ({
  powershellService: { execute: mockExecute }
}));

jest.mock('../../../../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { exportToMedia, importFromMedia } from '../../../../services/wsus/airgap';

function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

describe('WSUS Air-Gap Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('exportToMedia()', () => {
    it('should return success on successful export', async () => {
      mockExecute.mockResolvedValue(
        createSuccessResult('{"Success":true,"ExportedUpdates":150,"SizeGB":2.5,"Errors":[]}')
      );
      const result = await exportToMedia('D:/Export');
      expect(result.success).toBe(true);
      expect(result.exportedUpdates).toBe(150);
      expect(result.sizeGB).toBe(2.5);
    });

    it('should use Differential export by default', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('{"Success":true,"ExportedUpdates":50,"SizeGB":1.0,"Errors":[]}'));
      await exportToMedia('D:/Export');
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('Differential'), expect.any(Number));
    });

    it('should support Full export type', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('{"Success":true,"ExportedUpdates":500,"SizeGB":10.0,"Errors":[]}'));
      await exportToMedia('D:/Export', 'Full');
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("'Full'"), expect.any(Number));
    });

    it('should return errors when export fails', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('{"Success":false,"ExportedUpdates":0,"SizeGB":0,"Errors":["wsusutil not found"]}'));
      const result = await exportToMedia('D:/Export');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('wsusutil not found');
    });

    it('should return failure on PowerShell error', async () => {
      mockExecute.mockResolvedValue(createFailureResult('Access denied'));
      const result = await exportToMedia('D:/Export');
      expect(result.success).toBe(false);
    });

    it('should validate media path - reject empty', async () => {
      const result = await exportToMedia('');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid media path');
    });

    it('should validate media path - reject too long', async () => {
      const longPath = 'D:/' + 'a'.repeat(300);
      const result = await exportToMedia(longPath);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid media path');
    });

    it('should use 1 hour timeout', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('{"Success":true,"ExportedUpdates":10,"SizeGB":0.5,"Errors":[]}'));
      await exportToMedia('D:/Export');
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), 3600000);
    });

    it('should handle exceptions gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Disk full'));
      const result = await exportToMedia('D:/Export');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Disk full');
    });
  });

  describe('importFromMedia()', () => {
    it('should return success on successful import', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('{"Success":true,"ImportedUpdates":150,"Errors":[]}'));
      const result = await importFromMedia('D:/Import');
      expect(result.success).toBe(true);
      expect(result.importedUpdates).toBe(150);
    });

    it('should return failure when export directory not found', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('{"Success":false,"ImportedUpdates":0,"Errors":["Export directory not found"]}'));
      const result = await importFromMedia('D:/NonExistent');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Export directory not found');
    });

    it('should return failure on PowerShell error', async () => {
      mockExecute.mockResolvedValue(createFailureResult('WSUS unavailable'));
      const result = await importFromMedia('D:/Import');
      expect(result.success).toBe(false);
    });

    it('should validate media path - reject empty', async () => {
      const result = await importFromMedia('');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid media path');
    });

    it('should validate media path - reject too long', async () => {
      const longPath = 'D:/' + 'a'.repeat(300);
      const result = await importFromMedia(longPath);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid media path');
    });

    it('should use 1 hour timeout', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('{"Success":true,"ImportedUpdates":10,"Errors":[]}'));
      await importFromMedia('D:/Import');
      expect(mockExecute).toHaveBeenCalledWith(expect.any(String), 3600000);
    });

    it('should handle exceptions gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Permission denied'));
      const result = await importFromMedia('D:/Import');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Permission denied');
    });
  });
});
