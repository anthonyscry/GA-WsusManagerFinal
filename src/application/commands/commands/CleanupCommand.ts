import { ICommand } from '../ICommandHandler';
import { PerformCleanupUseCase } from '../../use-cases/maintenance/PerformCleanupUseCase';

/**
 * Cleanup Command
 * Triggers WSUS cleanup
 */
export class CleanupCommand implements ICommand {
  readonly name = 'cleanup';
  readonly description = 'Perform WSUS cleanup';

  constructor(private readonly cleanupUseCase: PerformCleanupUseCase) {}

  async execute(_args: string[]): Promise<string> {
    await this.cleanupUseCase.execute();
    return 'WSUS cleanup started';
  }
}
