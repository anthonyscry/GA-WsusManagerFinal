import { useState, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { BulkSyncComputersUseCase } from '../../application/use-cases/computers/BulkSyncComputersUseCase';

/**
 * Hook for bulk syncing computers
 */
export function useBulkSync() {
  const useCase = useService<BulkSyncComputersUseCase>(TOKENS.BULK_SYNC_COMPUTERS_USE_CASE);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sync = useCallback(async (computerIds: string[]) => {
    setIsSyncing(true);
    setError(null);
    
    try {
      await useCase.execute(computerIds);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [useCase]);

  return {
    sync,
    isSyncing,
    error
  };
}
