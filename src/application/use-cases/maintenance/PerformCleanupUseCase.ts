import { IStatsRepository } from '../../../domain/repositories/IStatsRepository';
import { IWsusClient } from '../../../infrastructure/external/wsus/IWsusClient';
import { ISqlClient } from '../../../infrastructure/external/sql/ISqlClient';
import { IJobManager } from '../../jobs/IJobManager';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { ExternalServiceError } from '../../../domain/errors/ExternalServiceError';

/**
 * Perform Cleanup Use Case
 * Orchestrates WSUS database cleanup operation
 */
export class PerformCleanupUseCase {
  constructor(
    private readonly statsRepo: IStatsRepository,
    private readonly wsusClient: IWsusClient,
    private readonly sqlClient: ISqlClient,
    private readonly jobManager: IJobManager,
    private readonly logger: ILogger
  ) {}

  async execute(): Promise<void> {
    const job = this.jobManager.createJob('Deep Cleanup Engine', 4000);

    try {
      const success = await this.wsusClient.performCleanup();
      
      if (!success) {
        this.jobManager.fail(job.id);
        throw new ExternalServiceError('WSUS cleanup failed', 'WSUS');
      }

      // Get updated database metrics
      const dbMetrics = await this.sqlClient.getDatabaseMetrics();
      if (dbMetrics) {
        const stats = await this.statsRepo.get();
        const oldSize = stats.db.currentSizeGB;
        stats.db = dbMetrics;
        
        const reclaimed = oldSize - dbMetrics.currentSizeGB;
        if (reclaimed > 0) {
          this.logger.warn(`SUSDB Optimization: Reclaimed ${reclaimed.toFixed(2)} GB.`);
        }
        
        await this.statsRepo.save(stats);
      } else {
        this.logger.info('WSUS cleanup completed successfully.');
      }

      this.jobManager.complete(job.id);
    } catch (error) {
      this.jobManager.fail(job.id);
      
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      this.logger.error('Cleanup error', { error });
      throw new ExternalServiceError(
        'Failed to perform cleanup',
        'WSUS',
        { originalError: error }
      );
    }
  }
}
