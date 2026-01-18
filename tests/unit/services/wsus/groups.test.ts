/**
 * Unit Tests for WSUS Groups Service
 */

import type { PowerShellResult } from '../../../../types';

const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();

jest.mock('../../../../services/powershellService', () => ({
  powershellService: { execute: mockExecute }
}));

jest.mock('../../../../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { getComputerGroups, getComputersInGroup, moveComputerToGroup } from '../../../../services/wsus/groups';

function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

function createJsonResult<T>(data: T): PowerShellResult {
  return createSuccessResult(JSON.stringify(data));
}

describe('WSUS Groups Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getComputerGroups()', () => {
    it('should return array of computer groups', async () => {
      mockExecute.mockResolvedValue(createJsonResult([
        { Id: 'group-001', Name: 'All Computers', ComputerCount: 50 },
        { Id: 'group-002', Name: 'Workstations', ComputerCount: 35 },
        { Id: 'group-003', Name: 'Servers', ComputerCount: 15 }
      ]));
      const groups = await getComputerGroups();
      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual({ id: 'group-001', name: 'All Computers', computerCount: 50 });
    });

    it('should handle single group response', async () => {
      mockExecute.mockResolvedValue(createJsonResult({ Id: 'group-001', Name: 'All Computers', ComputerCount: 10 }));
      const groups = await getComputerGroups();
      expect(groups).toHaveLength(1);
    });

    it('should return empty array on failure', async () => {
      mockExecute.mockResolvedValue(createFailureResult('WSUS not available'));
      const groups = await getComputerGroups();
      expect(groups).toEqual([]);
    });

    it('should return empty array on malformed JSON', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('not valid json'));
      const groups = await getComputerGroups();
      expect(groups).toEqual([]);
    });

    it('should handle missing fields with defaults', async () => {
      mockExecute.mockResolvedValue(createJsonResult([{ Name: 'Test Group' }]));
      const groups = await getComputerGroups();
      expect(groups[0]).toEqual({ id: '', name: 'Test Group', computerCount: 0 });
    });

    it('should handle exceptions gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Network error'));
      const groups = await getComputerGroups();
      expect(groups).toEqual([]);
    });
  });

  describe('getComputersInGroup()', () => {
    it('should return computers in specified group', async () => {
      mockExecute.mockResolvedValue(createJsonResult([
        { Id: 'pc-001', Name: 'PC001.corp.local', IpAddress: '192.168.1.101', LastReported: '2024-01-15 10:30' },
        { Id: 'pc-002', Name: 'PC002.corp.local', IpAddress: '192.168.1.102', LastReported: '2024-01-15 09:00' }
      ]));
      const computers = await getComputersInGroup('Workstations');
      expect(computers).toHaveLength(2);
      expect(computers[0]).toEqual({
        id: 'pc-001', name: 'PC001.corp.local', ipAddress: '192.168.1.101', lastReported: '2024-01-15 10:30'
      });
    });

    it('should return empty array when group not found', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('[]'));
      const computers = await getComputersInGroup('NonExistentGroup');
      expect(computers).toEqual([]);
    });

    it('should handle single computer response', async () => {
      mockExecute.mockResolvedValue(createJsonResult({ Id: 'pc-001', Name: 'PC001', IpAddress: '192.168.1.1', LastReported: '2024-01-15' }));
      const computers = await getComputersInGroup('SmallGroup');
      expect(computers).toHaveLength(1);
    });

    it('should return empty array on failure', async () => {
      mockExecute.mockResolvedValue(createFailureResult('Access denied'));
      const computers = await getComputersInGroup('Servers');
      expect(computers).toEqual([]);
    });

    it('should handle missing fields with defaults', async () => {
      mockExecute.mockResolvedValue(createJsonResult([{ Id: 'pc-001' }]));
      const computers = await getComputersInGroup('TestGroup');
      expect(computers[0]).toEqual({ id: 'pc-001', name: '', ipAddress: '', lastReported: 'Never' });
    });

    it('should handle exceptions gracefully', async () => {
      mockExecute.mockRejectedValue(new Error('Timeout'));
      const computers = await getComputersInGroup('TestGroup');
      expect(computers).toEqual([]);
    });

    it('should include group name in PowerShell script', async () => {
      mockExecute.mockResolvedValue(createJsonResult([]));
      await getComputersInGroup('My Test Group');
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('My Test Group'), expect.any(Number));
    });
  });

  describe('moveComputerToGroup()', () => {
    it('should return true on successful move', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('SUCCESS'));
      const result = await moveComputerToGroup('pc-001', 'Servers');
      expect(result).toBe(true);
    });

    it('should return false when group not found', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('GROUP_NOT_FOUND'));
      const result = await moveComputerToGroup('pc-001', 'NonExistent');
      expect(result).toBe(false);
    });

    it('should return false when computer not found', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('COMPUTER_NOT_FOUND'));
      const result = await moveComputerToGroup('invalid-id', 'Servers');
      expect(result).toBe(false);
    });

    it('should return false on PowerShell failure', async () => {
      mockExecute.mockResolvedValue(createFailureResult('Permission denied'));
      const result = await moveComputerToGroup('pc-001', 'Servers');
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockExecute.mockRejectedValue(new Error('Network error'));
      const result = await moveComputerToGroup('pc-001', 'Servers');
      expect(result).toBe(false);
    });

    it('should include computer ID and group name in script', async () => {
      mockExecute.mockResolvedValue(createSuccessResult('SUCCESS'));
      await moveComputerToGroup('test-computer-id', 'Target Group');
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('test-computer-id'), expect.any(Number));
      expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('Target Group'), expect.any(Number));
    });
  });
});
