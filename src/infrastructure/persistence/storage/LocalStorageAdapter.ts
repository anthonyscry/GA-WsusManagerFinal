import { IStorage } from './IStorage';

/**
 * LocalStorage Adapter
 * Implements IStorage interface using browser localStorage
 */
export class LocalStorageAdapter implements IStorage {
  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch {
      // Silent fail on parse errors - return null for missing/invalid data
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new Error(`Storage quota exceeded for key: ${key}`);
      }
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error: unknown) {
      // Silently fail - storage operations should not throw
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error: unknown) {
      // Silently fail - storage operations should not throw
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }
}
