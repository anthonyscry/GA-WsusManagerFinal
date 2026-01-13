/**
 * Format percentage with specified decimal places
 * 
 * @param value - Percentage value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format bytes to human-readable format
 * 
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format gigabytes with unit
 * 
 * @param gb - Size in gigabytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatGB(gb: number, decimals: number = 1): string {
  return `${gb.toFixed(decimals)} GB`;
}
