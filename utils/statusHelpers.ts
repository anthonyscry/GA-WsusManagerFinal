import { HealthStatus } from '../types';
import { COLORS } from '../constants';

/**
 * Get color class for health status badge
 * 
 * @param status - Health status
 * @returns Tailwind CSS color class
 */
export function getStatusBadgeColor(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY:
      return 'bg-emerald-500';
    case HealthStatus.WARNING:
      return 'bg-amber-500';
    case HealthStatus.CRITICAL:
      return 'bg-rose-500';
    default:
      return 'bg-slate-600';
  }
}

/**
 * Get hex color for health status
 * 
 * @param status - Health status
 * @returns Hex color code
 */
export function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY:
      return COLORS.HEALTHY;
    case HealthStatus.WARNING:
      return COLORS.WARNING;
    case HealthStatus.CRITICAL:
      return COLORS.CRITICAL;
    default:
      return COLORS.PRIMARY;
  }
}

/**
 * Get color class for percentage-based indicators
 * 
 * @param percentage - Percentage value (0-100)
 * @returns Tailwind CSS color class
 */
export function getPercentageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-blue-500';
  if (percentage >= 70) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * Get color class for database usage percentage
 * 
 * @param percentage - Database usage percentage (0-100)
 * @returns Tailwind CSS color class
 */
export function getDatabaseUsageColor(percentage: number): string {
  if (percentage > 85) return 'bg-rose-500';
  return 'bg-blue-500';
}
