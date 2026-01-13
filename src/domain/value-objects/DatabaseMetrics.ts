/**
 * Database Metrics Value Object
 * Immutable value object representing database metrics
 */
export interface DatabaseMetrics {
  readonly currentSizeGB: number;
  readonly maxSizeGB: number;
  readonly instanceName: string;
  readonly contentPath: string;
  readonly lastBackup: string;
}

/**
 * Create DatabaseMetrics with validation
 */
export function createDatabaseMetrics(
  currentSizeGB: number,
  maxSizeGB: number,
  instanceName: string,
  contentPath: string,
  lastBackup: string
): DatabaseMetrics {
  if (currentSizeGB < 0) throw new Error('currentSizeGB must be non-negative');
  if (maxSizeGB <= 0) throw new Error('maxSizeGB must be positive');
  if (currentSizeGB > maxSizeGB) throw new Error('currentSizeGB cannot exceed maxSizeGB');
  
  return {
    currentSizeGB: Math.round(currentSizeGB * 100) / 100, // Round to 2 decimals
    maxSizeGB: Math.round(maxSizeGB * 100) / 100,
    instanceName,
    contentPath,
    lastBackup
  };
}

/**
 * Calculate database usage percentage
 */
export function calculateDatabaseUsagePercentage(metrics: DatabaseMetrics): number {
  if (metrics.maxSizeGB === 0) return 0;
  return Math.round((metrics.currentSizeGB / metrics.maxSizeGB) * 100 * 10) / 10; // 1 decimal place
}

/**
 * Check if database usage is above warning threshold
 */
export function isDatabaseUsageWarning(metrics: DatabaseMetrics, threshold: number = 85): boolean {
  return calculateDatabaseUsagePercentage(metrics) > threshold;
}
