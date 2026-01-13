import { DomainError } from './DomainError';

/**
 * Error thrown when an external service call fails
 */
export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;

  constructor(
    message: string,
    public readonly service: string,
    context?: Record<string, unknown>
  ) {
    super(message, { service, ...context });
  }
}
