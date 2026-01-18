import { IStatsRepository } from '../../../domain/repositories/IStatsRepository';
import { IComputerRepository } from '../../../domain/repositories/IComputerRepository';
import { IWsusClient } from '../../../infrastructure/external/wsus/IWsusClient';
import { ISqlClient } from '../../../infrastructure/external/sql/ISqlClient';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { IEventBus } from '../../events/IEventBus';
import { ExternalServiceError } from '../../../domain/errors/ExternalServiceError';
import { StatsCalculator } from '../../../domain/services/StatsCalculator';
import { EnvironmentStats } from '../../../domain/entities/EnvironmentStats';
// Computer type used in computerRepo operations

/**
 * Refresh Telemetry Use Case
 * Orchestrates refreshing environment statistics and computer data
 */
export class RefreshTelemetryUseCase {
  constructor(
    private readonly statsRepo: IStatsRepository,
    private readonly computerRepo: IComputerRepository,
    private readonly wsusClient: IWsusClient,
    private readonly sqlClient: ISqlClient,
    private readonly logger: ILogger,
    private readonly eventBus: IEventBus
  ) {}

  async execute(): Promise<void> {
    this.logger.info('Polling infrastructure for fresh telemetry...');

    try {
      // Fetch data in parallel
      const [statsData, computersData] = await Promise.all([
        this.wsusClient.getStats(),
        this.wsusClient.getComputers()
      ]);

      // Update stats if available
      if (statsData) {
        // Get database metrics
        const dbMetrics = await this.sqlClient.getDatabaseMetrics();
        if (dbMetrics) {
          statsData.db = dbMetrics;
        }

        // Convert to entity and save
        const stats = this.toEnvironmentStats(statsData);
        await this.statsRepo.save(stats);
      }

      // Update computers if available
      if (computersData && computersData.length > 0) {
        await this.computerRepo.saveAll(computersData);
        
        // Recalculate stats from computers if we have stats
        if (statsData) {
          const stats = await this.statsRepo.get();
          const computers = await this.computerRepo.findAll();
          StatsCalculator.updateStatsFromComputers(stats, computers);
          await this.statsRepo.save(stats);
        }
      }

      // Publish event
      this.eventBus.publish('telemetry.refreshed', {
        timestamp: new Date().toISOString()
      });

      this.logger.info('Telemetry refresh completed successfully');
    } catch (error) {
      this.logger.error('Error refreshing telemetry', { error });
      
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'Failed to refresh telemetry',
        'WSUS',
        { originalError: error }
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEnvironmentStats(data: any): EnvironmentStats {
    // Convert from plain object to entity
    return new EnvironmentStats(
      data.totalComputers || 0,
      data.healthyComputers || 0,
      data.warningComputers || 0,
      data.criticalComputers || 0,
      data.totalUpdates || 0,
      data.securityUpdatesCount || 0,
      data.services || [],
      data.db,
      data.isInstalled || false,
      data.diskFreeGB || 0,
      data.automationStatus || 'Not Set'
    );
  }
}
