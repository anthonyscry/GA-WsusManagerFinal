import { useState, useEffect } from 'react';

interface ThroughputDataPoint {
  time: number;
  val: number;
}

const DATA_POINT_LIMIT = 20;
const UPDATE_INTERVAL_MS = 2000;
const MIN_THROUGHPUT = 20;
const MAX_THROUGHPUT = 70;

/**
 * Custom hook for monitoring network throughput data
 * Simulates throughput data with random values
 * 
 * @param enabled - Whether data collection is enabled
 * @param intervalMs - Update interval in milliseconds (default: 2000ms)
 * @param limit - Maximum number of data points to keep (default: 20)
 * @returns Array of throughput data points
 */
export function useThroughputData(
  enabled: boolean = true,
  intervalMs: number = UPDATE_INTERVAL_MS,
  limit: number = DATA_POINT_LIMIT
): ThroughputDataPoint[] {
  const [throughputData, setThroughputData] = useState<ThroughputDataPoint[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setThroughputData(prev => {
        const newDataPoint: ThroughputDataPoint = {
          time: Date.now(),
          val: Math.random() * (MAX_THROUGHPUT - MIN_THROUGHPUT) + MIN_THROUGHPUT
        };
        return [...prev, newDataPoint].slice(-limit);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [enabled, intervalMs, limit]);

  return throughputData;
}
