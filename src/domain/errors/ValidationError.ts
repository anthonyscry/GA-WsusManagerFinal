import { DomainError } from './DomainError';

/**
 * Error thrown when validation fails
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { field, ...context });
  }
}
