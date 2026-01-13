import { DatabaseMetrics } from '../../../domain/value-objects/DatabaseMetrics';

/**
 * SQL Client Interface
 * Defines contract for SQL Server operations
 */
export interface ISqlClient {
  /**
   * Get database metrics
   */
  getDatabaseMetrics(): Promise<DatabaseMetrics | null>;

  /**
   * Reindex database
   */
  reindexDatabase(saPassword?: string): Promise<boolean>;
}
