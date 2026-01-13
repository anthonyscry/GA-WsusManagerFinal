/**
 * Storage Interface
 * Abstraction for storage operations
 */
export interface IStorage {
  /**
   * Get value by key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value by key
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Remove value by key
   */
  remove(key: string): Promise<void>;

  /**
   * Clear all storage
   */
  clear(): Promise<void>;

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;
}
