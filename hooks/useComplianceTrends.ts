
import { useState, useEffect } from 'react';
import { EnvironmentStats } from '../types';

interface ComplianceTrendPoint {
  date: string;
  compliance: number;
  healthy: number;
  warning: number;
  critical: number;
}

/**
 * Generates compliance trend data for the last 30 days
 * Simulates historical data based on current stats
 */
export function useComplianceTrends(stats: EnvironmentStats): ComplianceTrendPoint[] {
  const [trendData, setTrendData] = useState<ComplianceTrendPoint[]>([]);

  useEffect(() => {
    if (stats.totalComputers === 0) {
      setTrendData([]);
      return;
    }

    // Generate trend data for the last 30 days
    const data: ComplianceTrendPoint[] = [];
    const today = new Date();
    const currentCompliance = stats.totalComputers > 0 
      ? Math.round((stats.healthyComputers / stats.totalComputers) * 100)
      : 0;

    // Simulate gradual improvement or variation over time
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Add some realistic variation (±5% with trend toward current value)
      const daysAgo = 29 - i;
      const trendFactor = daysAgo / 29; // 0 to 1
      const baseCompliance = Math.max(0, currentCompliance - (1 - trendFactor) * 10);
      const variation = (Math.random() - 0.5) * 10;
      const compliance = Math.min(100, Math.max(0, Math.round(baseCompliance + variation)));
      
      // Calculate healthy/warning/critical based on compliance
      const healthy = Math.round((stats.totalComputers * compliance) / 100);
      const remaining = stats.totalComputers - healthy;
      const warning = Math.round(remaining * 0.6);
      const critical = remaining - warning;

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        compliance,
        healthy,
        warning,
        critical
      });
    }

    setTrendData(data);
  }, [stats.totalComputers, stats.healthyComputers, stats.warningComputers, stats.criticalComputers]);

  return trendData;
}
