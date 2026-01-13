import { ICommandHandler } from '../../commands/ICommandHandler';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { ValidationError } from '../../../domain/errors/ValidationError';

/**
 * Process Terminal Command Use Case
 * Orchestrates terminal command processing
 */
export class ProcessTerminalCommandUseCase {
  constructor(
    private readonly commandHandler: ICommandHandler,
    private readonly logger: ILogger
  ) {}

  async execute(input: string): Promise<string> {
    // Validate input
    if (!input || typeof input !== 'string') {
      throw new ValidationError('Command input is required', 'input');
    }

    if (input.length > 1000) {
      throw new ValidationError('Command exceeds maximum length (1000 characters)', 'input');
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Command cannot be empty', 'input');
    }

    try {
      return await this.commandHandler.execute(trimmed);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      this.logger.error('Command execution failed', { error, input: trimmed.substring(0, 100) });
      throw new ValidationError(
        `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'command'
      );
    }
  }
}
