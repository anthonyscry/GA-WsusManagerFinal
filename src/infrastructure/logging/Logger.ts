import { ILogger } from './ILogger';

interface LoggingService {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

/**
 * Logger Implementation
 * Wraps existing loggingService to implement ILogger interface
 */
export class Logger implements ILogger {
  constructor(protected readonly loggingService: LoggingService) {}

  info(message: string, context?: Record<string, unknown>): void {
    this.loggingService.info(message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.loggingService.warn(message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.loggingService.error(message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    // Use info level if debug not available
    this.loggingService.info(`[DEBUG] ${message}`, context);
  }
}
