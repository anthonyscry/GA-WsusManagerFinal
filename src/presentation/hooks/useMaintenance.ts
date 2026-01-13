import { useState, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { PerformCleanupUseCase } from '../../application/use-cases/maintenance/PerformCleanupUseCase';
import { ReindexDatabaseUseCase } from '../../application/use-cases/maintenance/ReindexDatabaseUseCase';

/**
 * Hook for maintenance operations
 */
export function useMaintenance() {
  const cleanupUseCase = useService<PerformCleanupUseCase>(TOKENS.PERFORM_CLEANUP_USE_CASE);
  const reindexUseCase = useService<ReindexDatabaseUseCase>(TOKENS.REINDEX_DATABASE_USE_CASE);
  
  const [isCleaning, setIsCleaning] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const performCleanup = useCallback(async () => {
    setIsCleaning(true);
    setError(null);
    
    try {
      await cleanupUseCase.execute();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsCleaning(false);
    }
  }, [cleanupUseCase]);

  const reindexDatabase = useCallback(async (saPassword?: string) => {
    setIsReindexing(true);
    setError(null);
    
    try {
      await reindexUseCase.execute(saPassword);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsReindexing(false);
    }
  }, [reindexUseCase]);

  return {
    performCleanup,
    reindexDatabase,
    isCleaning,
    isReindexing,
    error
  };
}
