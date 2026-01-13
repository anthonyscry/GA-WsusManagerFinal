import { useState, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { RefreshTelemetryUseCase } from '../../application/use-cases/stats/RefreshTelemetryUseCase';
import { IEventBus } from '../../application/events/IEventBus';

/**
 * Hook for refreshing telemetry
 * Provides refresh function and loading state
 */
export function useRefreshTelemetry() {
  const useCase = useService<RefreshTelemetryUseCase>(TOKENS.REFRESH_TELEMETRY_USE_CASE);
  const eventBus = useService<IEventBus>(TOKENS.EVENT_BUS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      await useCase.execute();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [useCase]);

  return {
    refresh,
    isRefreshing,
    error
  };
}
