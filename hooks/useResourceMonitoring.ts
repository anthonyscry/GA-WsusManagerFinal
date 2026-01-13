import { useState, useEffect } from 'react';

interface ResourceMetrics {
  cpu: number;
  ram: number;
}

const DEFAULT_RESOURCES: ResourceMetrics = {
  cpu: 12,
  ram: 45
};

const UPDATE_INTERVAL_MS = 2000;

/**
 * Custom hook for monitoring CPU and RAM resources
 * Simulates resource monitoring with random jitter
 * 
 * @param enabled - Whether monitoring is enabled
 * @param intervalMs - Update interval in milliseconds (default: 2000ms)
 * @returns Current resource metrics
 */
export function useResourceMonitoring(
  enabled: boolean = true,
  intervalMs: number = UPDATE_INTERVAL_MS
): ResourceMetrics {
  const [resources, setResources] = useState<ResourceMetrics>(DEFAULT_RESOURCES);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setResources({
        cpu: Math.floor(Math.random() * 15) + 5,
        ram: 42 + Math.random() * 4
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return resources;
}
