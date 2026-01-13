import { DomainError } from './DomainError';

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(
    message: string,
    public readonly resourceType?: string,
    public readonly resourceId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { resourceType, resourceId, ...context });
  }
}
