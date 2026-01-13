import { IComputerRepository } from '../../../domain/repositories/IComputerRepository';
import { IWsusClient } from '../../../infrastructure/external/wsus/IWsusClient';
import { IJobManager } from '../../jobs/IJobManager';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { ExternalServiceError } from '../../../domain/errors/ExternalServiceError';
import { NotFoundError } from '../../../domain/errors/NotFoundError';

/**
 * Bulk Sync Computers Use Case
 * Orchestrates syncing multiple computers with WSUS
 */
export class BulkSyncComputersUseCase {
  constructor(
    private readonly computerRepo: IComputerRepository,
    private readonly wsusClient: IWsusClient,
    private readonly jobManager: IJobManager,
    private readonly logger: ILogger
  ) {}

  async execute(computerIds: string[]): Promise<void> {
    if (!Array.isArray(computerIds) || computerIds.length === 0) {
      throw new Error('Computer IDs array is required and cannot be empty');
    }

    if (computerIds.length > 1000) {
      throw new Error('Cannot sync more than 1000 computers at once');
    }

    const job = this.jobManager.createJob(
      `Bulk SYNC (${computerIds.length} Nodes)`,
      3500
    );

    try {
      // Load all computers
      const computers = await Promise.all(
        computerIds.map(id => this.computerRepo.findById(id))
      );

      const validComputers = computers.filter(
        (c): c is NonNullable<typeof c> => c !== null
      );

      if (validComputers.length === 0) {
        throw new NotFoundError('No valid computers found', 'Computer', computerIds.join(','));
      }

      // Sync each computer
      let successCount = 0;
      for (const computer of validComputers) {
        try {
          const success = await this.wsusClient.forceComputerSync(computer.name);
          
          if (success) {
            computer.markSynced();
            await this.computerRepo.save(computer);
            successCount++;
          }
        } catch (error) {
          this.logger.warn(`Failed to sync computer ${computer.name}`, { error, computerId: computer.id });
        }
      }

      this.jobManager.complete(job.id);
      this.logger.info(`Bulk sync completed: ${successCount}/${validComputers.length} computers synced`);
    } catch (error) {
      this.jobManager.fail(job.id);
      
      if (error instanceof NotFoundError || error instanceof ExternalServiceError) {
        throw error;
      }
      
      this.logger.error('Bulk sync failed', { error, computerIds });
      throw new ExternalServiceError(
        'Bulk sync operation failed',
        'WSUS',
        { error, computerIds }
      );
    }
  }
}
