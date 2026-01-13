import { ICommand } from '../ICommandHandler';
import { LoggingServiceAdapter } from '../../../infrastructure/logging/LoggingServiceAdapter';

/**
 * Clear Command
 * Clears logs
 */
export class ClearCommand implements ICommand {
  readonly name = 'clear';
  readonly description = 'Clear log history';

  constructor(private readonly loggingService: LoggingServiceAdapter) {}

  async execute(args: string[]): Promise<string> {
    this.loggingService.clearLogs();
    return 'Logs cleared';
  }
}
