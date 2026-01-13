import { ISqlClient } from '../../../infrastructure/external/sql/ISqlClient';
import { IJobManager } from '../../jobs/IJobManager';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { ExternalServiceError } from '../../../domain/errors/ExternalServiceError';

/**
 * Reindex Database Use Case
 * Orchestrates SQL database reindexing operation
 */
export class ReindexDatabaseUseCase {
  constructor(
    private readonly sqlClient: ISqlClient,
    private readonly jobManager: IJobManager,
    private readonly logger: ILogger
  ) {}

  async execute(saPassword?: string): Promise<void> {
    const job = this.jobManager.createJob('SQL Index Defragmentation', 5000);

    try {
      const success = await this.sqlClient.reindexDatabase(saPassword);
      
      if (!success) {
        this.jobManager.fail(job.id);
        throw new ExternalServiceError('SQL reindex failed', 'SQL');
      }

      this.logger.info('SQL_SUCCESS: Index defragmentation completed.');
      this.jobManager.complete(job.id);
    } catch (error) {
      this.jobManager.fail(job.id);
      
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      this.logger.error('Reindex error', { error });
      throw new ExternalServiceError(
        'Failed to reindex database',
        'SQL',
        { originalError: error }
      );
    }
  }
}
