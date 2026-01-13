import { useState, useEffect } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { IStatsRepository } from '../../domain/repositories/IStatsRepository';
import { EnvironmentStats as DomainEnvironmentStats } from '../../domain/entities/EnvironmentStats';
import { EnvironmentStats } from '../../../types';
import { IEventBus } from '../../application/events/IEventBus';

/**
 * Convert domain EnvironmentStats entity to interface
 */
function toEnvironmentStats(domainStats: DomainEnvironmentStats): EnvironmentStats {
  return {
    totalComputers: domainStats.totalComputers,
    healthyComputers: domainStats.healthyComputers,
    warningComputers: domainStats.warningComputers,
    criticalComputers: domainStats.criticalComputers,
    totalUpdates: domainStats.totalUpdates,
    securityUpdatesCount: domainStats.securityUpdatesCount,
    services: domainStats.services,
    db: {
      currentSizeGB: domainStats.db.currentSizeGB,
      maxSizeGB: domainStats.db.maxSizeGB,
      instanceName: domainStats.db.instanceName,
      contentPath: domainStats.db.contentPath,
      lastBackup: domainStats.db.lastBackup
    },
    isInstalled: domainStats.isInstalled,
    diskFreeGB: domainStats.diskFreeGB,
    automationStatus: domainStats.automationStatus
  };
}

/**
 * Hook for accessing environment statistics
 * Subscribes to updates via event bus
 */
export function useStats() {
  const statsRepository = useService<IStatsRepository>(TOKENS.STATS_REPOSITORY);
  const eventBus = useService<IEventBus>(TOKENS.EVENT_BUS);
  const [stats, setStats] = useState<EnvironmentStats>(toEnvironmentStats(DomainEnvironmentStats.empty()));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial stats
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const data = await statsRepository.get();
        setStats(toEnvironmentStats(data));
      } catch (error) {
        console.error('Failed to load stats', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();

    // Subscribe to stats updates
    const unsubscribe = eventBus.subscribe('stats.updated', async () => {
      const data = await statsRepository.get();
      setStats(toEnvironmentStats(data));
    });

    return unsubscribe;
  }, [statsRepository, eventBus]);

  return {
    stats,
    isLoading
  };
}
