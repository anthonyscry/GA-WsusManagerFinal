import { Logger } from './Logger';
import { loggingService } from '../../../services/loggingService';
import { LogEntry } from '../../../types';

/**
 * Logging Service Adapter
 * Wraps existing loggingService to provide clearLogs functionality
 */
export class LoggingServiceAdapter extends Logger {
  constructor() {
    super(loggingService);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    loggingService.clearLogs();
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return loggingService.getLogs();
  }
}
