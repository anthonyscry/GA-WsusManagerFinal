import { EnvironmentStats } from '../types';
import { COLORS } from '../constants';

export interface PieDataItem {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

/**
 * Generate pie chart data from environment stats
 * 
 * @param stats - Environment statistics
 * @returns Array of pie chart data items
 */
export function generatePieChartData(stats: EnvironmentStats): PieDataItem[] {
  return [
    { name: 'Healthy', value: stats.healthyComputers, color: COLORS.HEALTHY },
    { name: 'Warning', value: stats.warningComputers, color: COLORS.WARNING },
    { name: 'Critical', value: stats.criticalComputers, color: COLORS.CRITICAL },
  ];
}
