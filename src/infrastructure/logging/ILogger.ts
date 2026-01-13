/**
 * Logger Interface
 * Abstraction for logging operations
 */
export interface ILogger {
  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>): void;

  /**
   * Log debug message
   */
  debug?(message: string, context?: Record<string, unknown>): void;
}
