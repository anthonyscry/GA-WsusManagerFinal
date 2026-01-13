/**
 * Retry Utility
 * Provides exponential backoff retry logic for async operations
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/**
 * Execute an async function with exponential backoff retry
 * @param fn The async function to execute
 * @param options Retry configuration options
 * @returns Result object with success status, data, and attempt count
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let currentDelay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        data: result,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt >= maxAttempts || !isRetryable(error)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
        };
      }

      // Calculate delay with optional jitter
      let delay = Math.min(currentDelay, maxDelay);
      if (jitter) {
        // Add +/- 25% jitter
        const jitterAmount = delay * 0.25;
        delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
      }

      // Notify about retry
      if (onRetry) {
        onRetry(attempt, error, delay);
      }

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next attempt
      currentDelay *= backoffMultiplier;
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: maxAttempts,
  };
}

/**
 * Sleep utility
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retryable version of an async function
 * @param fn The async function to wrap
 * @param options Default retry options
 * @returns A function that will retry on failure
 */
export function createRetryable<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: RetryOptions = {}
): (...args: Args) => Promise<RetryResult<T>> {
  return (...args: Args) => withRetry(() => fn(...args), options);
}

/**
 * Common retryable error checkers
 */
export const retryableCheckers = {
  /** Retry on network errors */
  networkError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('fetch failed')
      );
    }
    return false;
  },

  /** Retry on transient server errors (5xx) */
  serverError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('internal server error') ||
        msg.includes('bad gateway') ||
        msg.includes('service unavailable')
      );
    }
    return false;
  },

  /** Retry on PowerShell execution failures */
  powershellError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('timeout') ||
        msg.includes('connection') ||
        msg.includes('access denied') ||
        msg.includes('temporarily unavailable')
      );
    }
    return false;
  },

  /** Combine multiple checkers */
  any: (...checkers: Array<(error: unknown) => boolean>) => {
    return (error: unknown): boolean => checkers.some(check => check(error));
  },
};

export default withRetry;
