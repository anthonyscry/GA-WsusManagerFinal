import { EnvironmentStats } from '../entities/EnvironmentStats';

/**
 * Stats Repository Interface
 * Defines contract for environment statistics data access
 */
export interface IStatsRepository {
  /**
   * Get current environment stats
   */
  get(): Promise<EnvironmentStats>;

  /**
   * Save environment stats
   */
  save(stats: EnvironmentStats): Promise<void>;

  /**
   * Clear all stats (reset to empty)
   */
  clear(): Promise<void>;
}
