/**
 * Constants specific to Dashboard component
 */

export const DASHBOARD_CONSTANTS = {
  // Resource monitoring
  RESOURCE_UPDATE_INTERVAL_MS: 2000,
  DEFAULT_CPU_PERCENTAGE: 12,
  DEFAULT_RAM_PERCENTAGE: 45,
  CPU_RANDOM_RANGE: { min: 5, max: 20 },
  RAM_RANDOM_RANGE: { min: 42, max: 46 },

  // Throughput monitoring
  THROUGHPUT_UPDATE_INTERVAL_MS: 2000,
  THROUGHPUT_DATA_LIMIT: 20,
  THROUGHPUT_RANDOM_RANGE: { 
    min: 20, 
    max: 70 
  },

  // Database usage thresholds
  DATABASE_WARNING_THRESHOLD: 85,

  // Chart configuration
  PIE_CHART_INNER_RADIUS: 70,
  PIE_CHART_OUTER_RADIUS: 90,
  PIE_CHART_PADDING_ANGLE: 10
} as const;
