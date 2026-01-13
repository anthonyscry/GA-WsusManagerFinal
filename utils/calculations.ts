/**
 * Calculate percentage with optional decimal precision
 * 
 * @param value - Current value
 * @param max - Maximum value
 * @param precision - Decimal places (default: 1)
 * @returns Percentage value
 */
export function calculatePercentage(value: number, max: number, precision: number = 1): number {
  if (max === 0) return 0;
  return Number(((value / max) * 100).toFixed(precision));
}

/**
 * Calculate database usage percentage
 * 
 * @param currentSizeGB - Current database size in GB
 * @param maxSizeGB - Maximum database size in GB
 * @returns Percentage usage
 */
export function calculateDatabaseUsagePercentage(currentSizeGB: number, maxSizeGB: number): number {
  return calculatePercentage(currentSizeGB, maxSizeGB);
}

/**
 * Calculate compliance percentage based on installed vs total updates
 * 
 * @param installed - Number of installed updates
 * @param needed - Number of updates needed
 * @returns Compliance percentage
 */
export function calculateCompliancePercentage(installed: number, needed: number): number {
  const total = installed + needed;
  if (total === 0) return 100;
  return calculatePercentage(installed, total, 0);
}
