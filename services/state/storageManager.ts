/**
 * Storage management for state persistence
 */

import { EnvironmentStats, WsusComputer, ScheduledTask } from '../../types';
import { loggingService } from '../loggingService';
import { STORAGE_KEY_STATS, STORAGE_KEY_COMPUTERS, STORAGE_KEY_TASKS } from './types';

export class StorageManager {
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Clear all storage on initialization
   */
  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_STATS);
      localStorage.removeItem(STORAGE_KEY_COMPUTERS);
      localStorage.removeItem(STORAGE_KEY_TASKS);
    } catch {
      console.warn('localStorage not available');
    }
  }

  /**
   * Debounced persist to storage
   */
  debouncedPersist(stats: EnvironmentStats, computers: WsusComputer[], tasks: ScheduledTask[]): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }
    this.persistTimeout = setTimeout(() => {
      this.persistToStorage(stats, computers, tasks);
    }, 1000);
  }

  /**
   * Persist state to localStorage
   */
  private persistToStorage(stats: EnvironmentStats, computers: WsusComputer[], tasks: ScheduledTask[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
      localStorage.setItem(STORAGE_KEY_COMPUTERS, JSON.stringify(computers));
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearOldStorage();
        try {
          localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
          localStorage.setItem(STORAGE_KEY_COMPUTERS, JSON.stringify(computers));
          localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
        } catch {
          loggingService.error('Storage quota exceeded. Data not persisted.');
        }
      } else {
        loggingService.error('Failed to persist state');
      }
    }
  }

  /**
   * Clear old storage to free space
   */
  private clearOldStorage(): void {
    try {
      const stats = localStorage.getItem(STORAGE_KEY_STATS);
      if (stats) {
        try {
          const parsed = JSON.parse(stats) as { computers?: unknown[] };
          if (parsed.computers && Array.isArray(parsed.computers) && parsed.computers.length > 100) {
            parsed.computers = parsed.computers.slice(-100);
          }
          localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(parsed));
        } catch {
          localStorage.removeItem(STORAGE_KEY_STATS);
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}
