/**
 * Debugging Utilities for GA-WsusManager Pro
 * 
 * Provides helper functions for debugging, diagnostics, and issue resolution.
 * Use these utilities to quickly diagnose issues during development and production.
 */

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Safely extract error stack trace
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}

/**
 * Sanitize error messages to remove sensitive data
 * Removes file paths, stack traces, and potentially sensitive information
 */
export function sanitizeError(error: unknown, maxLength: number = 200): string {
  let message = getErrorMessage(error);
  
  // Remove file paths (Windows format)
  message = message.replace(/[A-Z]:\\[^\s]+/gi, '[PATH]');
  // Remove file paths (Unix format)
  message = message.replace(/\/[^\s]+/g, '[PATH]');
  // Remove stack trace lines
  message = message.replace(/at\s+.*\n/g, '');
  // Remove passwords and tokens (basic patterns)
  message = message.replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]');
  message = message.replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]');
  message = message.replace(/key[=:]\s*\S+/gi, 'key=[REDACTED]');
  // Remove email addresses from error messages
  message = message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  // Limit length
  if (message.length > maxLength) {
    message = message.substring(0, maxLength) + '...';
  }
  
  return message;
}

/**
 * Create a context object for error logging
 */
export function createErrorContext(
  functionName: string,
  additionalContext?: Record<string, unknown>
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    function: functionName,
    ...additionalContext
  };
}

/**
 * Measure execution time of an async function
 * Useful for performance debugging
 */
export async function measureAsyncExecution<T>(
  fn: () => Promise<T>,
  label: string = 'Execution'
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`[PERF] ${label} took ${duration}ms (slow)`);
    } else {
      console.debug(`[PERF] ${label} took ${duration}ms`);
    }
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PERF] ${label} failed after ${duration}ms`, error);
    throw error;
  }
}

/**
 * Measure execution time of a synchronous function
 */
export function measureSyncExecution<T>(
  fn: () => T,
  label: string = 'Execution'
): { result: T; duration: number } {
  const startTime = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.warn(`[PERF] ${label} took ${duration}ms (slow)`);
    } else {
      console.debug(`[PERF] ${label} took ${duration}ms`);
    }
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PERF] ${label} failed after ${duration}ms`, error);
    throw error;
  }
}

/**
 * Retry an async operation with exponential backoff
 * Useful for handling transient failures
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    multiplier?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    multiplier = 2,
    onRetry
  } = options;

  let lastError: unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelayMs * Math.pow(multiplier, attempt),
          maxDelayMs
        );
        
        if (onRetry) {
          onRetry(attempt + 1, error);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Execute with timeout
 * Prevents operations from hanging indefinitely
 */
export async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timeout'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Safe JSON parse with default value
 * Prevents crashes from malformed JSON
 */
export function safeJsonParse<T>(
  json: string,
  defaultValue: T
): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', sanitizeError(error));
    return defaultValue;
  }
}

/**
 * Safe localStorage operations with error handling
 */
export class SafeLocalStorage {
  /**
   * Safely get item from localStorage
   */
  static getItem(key: string, defaultValue: string = ''): string {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch (error) {
      console.error(`Failed to get localStorage item '${key}':`, sanitizeError(error));
      return defaultValue;
    }
  }

  /**
   * Safely set item in localStorage with quota handling
   */
  static setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'QuotaExceededError') {
        console.warn(`LocalStorage quota exceeded for key '${key}'`);
        // Could implement cleanup logic here
        return false;
      }
      console.error(`Failed to set localStorage item '${key}':`, sanitizeError(error));
      return false;
    }
  }

  /**
   * Safely remove item from localStorage
   */
  static removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove localStorage item '${key}':`, sanitizeError(error));
      return false;
    }
  }

  /**
   * Get localStorage size in bytes (approximate)
   */
  static getStorageSize(): number {
    let total = 0;
    try {
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          total += localStorage[key].length + key.length;
        }
      }
    } catch (error) {
      console.error('Failed to calculate localStorage size:', sanitizeError(error));
    }
    return total;
  }

  /**
   * Check if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a debug logger for a specific module/function
 * Provides structured logging with context
 */
export function createDebugLogger(module: string) {
  return {
    debug: (message: string, context?: Record<string, unknown>) => {
      console.debug(`[${module}] ${message}`, context || '');
    },
    info: (message: string, context?: Record<string, unknown>) => {
      console.info(`[${module}] ${message}`, context || '');
    },
    warn: (message: string, context?: Record<string, unknown>) => {
      console.warn(`[${module}] ${message}`, context || '');
    },
    error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
      const errorMessage = error ? sanitizeError(error) : '';
      const fullContext = error ? { ...context, error: errorMessage } : context;
      console.error(`[${module}] ${message}`, fullContext || '');
    }
  };
}

/**
 * Check if value is null or undefined
 * Type guard for null safety
 */
export function isNullish<T>(value: T | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Assert that a value is not null/undefined
 * Throws descriptive error if value is nullish
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  message: string = 'Value is null or undefined'
): asserts value is T {
  if (isNullish(value)) {
    throw new Error(message);
  }
}

/**
 * Create a diagnostic report of the application state
 * Useful for debugging sessions
 */
export function createDiagnosticReport(): {
  timestamp: string;
  localStorage: {
    available: boolean;
    size: number;
    keys: string[];
  };
  environment: {
    userAgent: string;
    platform: string;
    language: string;
  };
} {
  return {
    timestamp: new Date().toISOString(),
    localStorage: {
      available: SafeLocalStorage.isAvailable(),
      size: SafeLocalStorage.getStorageSize(),
      keys: (() => {
        try {
          return Object.keys(localStorage);
        } catch {
          return [];
        }
      })()
    },
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'N/A',
      language: typeof navigator !== 'undefined' ? navigator.language : 'N/A'
    }
  };
}
