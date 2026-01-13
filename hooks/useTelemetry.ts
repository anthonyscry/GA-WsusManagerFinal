import { useState, useEffect } from 'react';
import { stateService } from '../services/stateService';
import { EnvironmentStats } from '../types';

/**
 * Custom hook for subscribing to state service updates
 * Automatically updates component state when state service changes
 * 
 * @returns Current environment stats
 */
export function useTelemetry(): EnvironmentStats {
  const [stats, setStats] = useState<EnvironmentStats>(stateService.getStats());

  useEffect(() => {
    const unsubscribe = stateService.subscribe(() => {
      setStats({ ...stateService.getStats() });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return stats;
}
