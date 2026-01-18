import { IStatsRepository } from '../../../domain/repositories/IStatsRepository';
import { EnvironmentStats } from '../../../domain/entities/EnvironmentStats';
import { IStorage } from '../storage/IStorage';
import { ILogger } from '../../logging/ILogger';
import { config } from '../../config';

/**
 * Stats Repository Implementation
 * Uses storage adapter for persistence
 */
export class StatsRepository implements IStatsRepository {
  private readonly storageKey: string;

  constructor(
    private readonly storage: IStorage,
    private readonly logger: ILogger
  ) {
    this.storageKey = config.storage.keys.stats;
  }

  async get(): Promise<EnvironmentStats> {
    try {
      const data = await this.storage.get<Record<string, unknown>>(this.storageKey);
      if (!data) {
        return EnvironmentStats.empty();
      }
      return this.toEnvironmentStats(data);
    } catch (error) {
      this.logger.error('Failed to load stats', { error });
      return EnvironmentStats.empty();
    }
  }

  async save(stats: EnvironmentStats): Promise<void> {
    try {
      await this.storage.set(this.storageKey, stats.toJSON());
    } catch (error) {
      this.logger.error('Failed to save stats', { error });
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.remove(this.storageKey);
    } catch (error) {
      this.logger.error('Failed to clear stats', { error });
    }
  }

  private toEnvironmentStats(data: Record<string, unknown>): EnvironmentStats {
    return new EnvironmentStats(
      (data.totalComputers as number) || 0,
      (data.healthyComputers as number) || 0,
      (data.warningComputers as number) || 0,
      (data.criticalComputers as number) || 0,
      (data.totalUpdates as number) || 0,
      (data.securityUpdatesCount as number) || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data.services as any[]) || [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.db as any,
      (data.isInstalled as boolean) || false,
      (data.diskFreeGB as number) || 0,
      (data.automationStatus as 'Ready' | 'Not Set' | 'Running') || 'Not Set'
    );
  }
}
