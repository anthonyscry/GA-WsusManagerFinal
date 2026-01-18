/**
 * Unit Tests for Storage Manager Service
 * Tests localStorage persistence and debouncing
 */

import { StorageManager } from '../../../../services/state/storageManager';
import { STORAGE_KEY_STATS, STORAGE_KEY_COMPUTERS, STORAGE_KEY_TASKS } from '../../../../services/state/types';
import { HealthStatus } from '../../../../types';
import type { EnvironmentStats, WsusComputer, ScheduledTask } from '../../../../types';

// Mock loggingService
jest.mock('../../../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('Storage Manager Service', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
    storageManager = new StorageManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Create minimal test data
  const testStats: EnvironmentStats = {
    isInstalled: true,
    totalComputers: 10,
    healthyComputers: 8,
    warningComputers: 1,
    criticalComputers: 1,
    totalUpdates: 100,
    securityUpdatesCount: 25,
    diskFreeGB: 50,
    services: [],
    db: {
      currentSizeGB: 2,
      maxSizeGB: 10,
      instanceName: 'SQLEXPRESS',
      contentPath: 'C:\\WSUS\\Content',
      lastBackup: '2024-01-01'
    },
    automationStatus: 'Ready',
  };

  const testComputers: WsusComputer[] = [
    {
      id: '1',
      name: 'PC001',
      ipAddress: '192.168.1.1',
      os: 'Windows 10',
      status: HealthStatus.HEALTHY,
      lastSync: '2024-01-01',
      updatesNeeded: 0,
      updatesInstalled: 50,
      targetGroup: 'Workstations'
    }
  ];

  const testTasks: ScheduledTask[] = [
    {
      id: '1',
      name: 'Daily Sync',
      trigger: 'Daily',
      time: '02:00',
      lastRun: '2024-01-01',
      nextRun: '2024-01-02',
      status: 'Ready'
    }
  ];

  // =========================================================================
  // clearAll() Tests
  // =========================================================================
  describe('clearAll()', () => {
    
    it('should remove all storage keys', () => {
      // Set up storage
      localStorage.setItem(STORAGE_KEY_STATS, 'stats');
      localStorage.setItem(STORAGE_KEY_COMPUTERS, 'computers');
      localStorage.setItem(STORAGE_KEY_TASKS, 'tasks');
      
      storageManager.clearAll();
      
      expect(localStorage.getItem(STORAGE_KEY_STATS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY_COMPUTERS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY_TASKS)).toBeNull();
    });

    it('should not affect other localStorage keys', () => {
      localStorage.setItem('other_key', 'value');
      localStorage.setItem(STORAGE_KEY_STATS, 'stats');
      
      storageManager.clearAll();
      
      expect(localStorage.getItem('other_key')).toBe('value');
    });

    it('should handle missing keys gracefully', () => {
      // Should not throw when keys don't exist
      expect(() => {
        storageManager.clearAll();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // debouncedPersist() Tests
  // =========================================================================
  describe('debouncedPersist()', () => {
    
    it('should not persist immediately', () => {
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      
      expect(localStorage.getItem(STORAGE_KEY_STATS)).toBeNull();
    });

    it('should persist after debounce delay', () => {
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      
      // Advance past debounce delay (1000ms in implementation)
      jest.advanceTimersByTime(1100);
      
      expect(localStorage.getItem(STORAGE_KEY_STATS)).not.toBeNull();
      expect(localStorage.getItem(STORAGE_KEY_COMPUTERS)).not.toBeNull();
      expect(localStorage.getItem(STORAGE_KEY_TASKS)).not.toBeNull();
    });

    it('should debounce rapid calls', () => {
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      
      // Advance partially
      jest.advanceTimersByTime(500);
      
      // Call again - should reset timer
      const updatedStats = { ...testStats, totalComputers: 20 };
      storageManager.debouncedPersist(updatedStats, testComputers, testTasks);
      
      // Advance past original timeout but not new one
      jest.advanceTimersByTime(600);
      
      // Should not have persisted yet
      expect(localStorage.getItem(STORAGE_KEY_STATS)).toBeNull();
      
      // Advance past new timeout
      jest.advanceTimersByTime(500);
      
      // Now should be persisted with updated value
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_STATS)!);
      expect(stored.totalComputers).toBe(20);
    });

    it('should persist stats as JSON', () => {
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      jest.advanceTimersByTime(1100);
      
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_STATS)!);
      expect(stored.totalComputers).toBe(testStats.totalComputers);
      expect(stored.isInstalled).toBe(testStats.isInstalled);
    });

    it('should persist computers as JSON array', () => {
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      jest.advanceTimersByTime(1100);
      
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_COMPUTERS)!);
      expect(Array.isArray(stored)).toBe(true);
      expect(stored[0].name).toBe('PC001');
    });

    it('should persist tasks as JSON array', () => {
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      jest.advanceTimersByTime(1100);
      
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS)!);
      expect(Array.isArray(stored)).toBe(true);
      expect(stored[0].name).toBe('Daily Sync');
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe('error handling', () => {
    
    it('should handle clearAll when storage is already empty', () => {
      // Ensure storage is empty
      localStorage.clear();
      
      // Should not throw when clearing already empty storage
      expect(() => {
        storageManager.clearAll();
      }).not.toThrow();
    });

    it('should handle partial storage state', () => {
      // Only set some keys
      localStorage.setItem(STORAGE_KEY_STATS, 'stats');
      // STORAGE_KEY_COMPUTERS and STORAGE_KEY_TASKS not set
      
      // Should not throw
      expect(() => {
        storageManager.clearAll();
      }).not.toThrow();
      
      expect(localStorage.getItem(STORAGE_KEY_STATS)).toBeNull();
    });
  });

  // =========================================================================
  // Integration Scenarios
  // =========================================================================
  describe('integration scenarios', () => {
    
    it('should handle multiple persist-clear cycles', () => {
      // First persist
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      jest.advanceTimersByTime(1100);
      expect(localStorage.getItem(STORAGE_KEY_STATS)).not.toBeNull();
      
      // Clear
      storageManager.clearAll();
      expect(localStorage.getItem(STORAGE_KEY_STATS)).toBeNull();
      
      // Persist again
      storageManager.debouncedPersist(testStats, testComputers, testTasks);
      jest.advanceTimersByTime(1100);
      expect(localStorage.getItem(STORAGE_KEY_STATS)).not.toBeNull();
    });

    it('should handle empty arrays', () => {
      storageManager.debouncedPersist(testStats, [], []);
      jest.advanceTimersByTime(1100);
      
      const computers = JSON.parse(localStorage.getItem(STORAGE_KEY_COMPUTERS)!);
      const tasks = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS)!);
      
      expect(computers).toEqual([]);
      expect(tasks).toEqual([]);
    });
  });
});
