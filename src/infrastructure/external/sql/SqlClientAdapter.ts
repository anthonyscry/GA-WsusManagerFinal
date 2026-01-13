import { ISqlClient } from './ISqlClient';
import { DatabaseMetrics, createDatabaseMetrics } from '../../../domain/value-objects/DatabaseMetrics';
import { ILogger } from '../../logging/ILogger';
import { sqlService } from '../../../../services/sqlService';

/**
 * SQL Client Adapter
 * Wraps existing sqlService to implement ISqlClient interface
 */
export class SqlClientAdapter implements ISqlClient {
  constructor(private readonly logger: ILogger) {}

  async getDatabaseMetrics(): Promise<DatabaseMetrics | null> {
    try {
      const metrics = await sqlService.getDatabaseMetrics();
      if (!metrics) return null;

      return createDatabaseMetrics(
        metrics.currentSizeGB,
        metrics.maxSizeGB,
        metrics.instanceName,
        metrics.contentPath,
        metrics.lastBackup
      );
    } catch (error) {
      this.logger.error('Failed to get database metrics', { error });
      return null;
    }
  }

  async reindexDatabase(saPassword?: string): Promise<boolean> {
    try {
      return await sqlService.reindexDatabase(saPassword);
    } catch (error) {
      this.logger.error('Failed to reindex database', { error });
      return false;
    }
  }
}
