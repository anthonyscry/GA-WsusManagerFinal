import { DomainError } from './DomainError';

/**
 * Error thrown for internal/unexpected errors
 */
export class InternalError extends DomainError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;

  constructor(
    message: string = 'An unexpected error occurred',
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}
