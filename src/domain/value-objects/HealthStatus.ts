/**
 * Health Status Value Object
 * Immutable value object representing computer health status
 */
export enum HealthStatus {
  HEALTHY = 'Healthy',
  WARNING = 'Warning',
  CRITICAL = 'Critical',
  UNKNOWN = 'Unknown'
}

/**
 * Parse string to HealthStatus enum
 */
export function parseHealthStatus(value: string): HealthStatus {
  const upper = value.toUpperCase();
  if (upper === 'HEALTHY') return HealthStatus.HEALTHY;
  if (upper === 'WARNING') return HealthStatus.WARNING;
  if (upper === 'CRITICAL') return HealthStatus.CRITICAL;
  return HealthStatus.UNKNOWN;
}

/**
 * Get health status based on last sync time
 */
export function getHealthStatusFromLastSync(lastSync: Date | string | null): HealthStatus {
  if (!lastSync) return HealthStatus.UNKNOWN;
  
  const syncDate = typeof lastSync === 'string' ? new Date(lastSync) : lastSync;
  if (isNaN(syncDate.getTime())) return HealthStatus.UNKNOWN;
  
  const daysSinceSync = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceSync <= 7) return HealthStatus.HEALTHY;
  if (daysSinceSync <= 30) return HealthStatus.WARNING;
  return HealthStatus.CRITICAL;
}
