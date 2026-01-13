import { ICommand } from '../ICommandHandler';
import { ReindexDatabaseUseCase } from '../../use-cases/maintenance/ReindexDatabaseUseCase';

/**
 * Reindex Command
 * Triggers database reindexing
 */
export class ReindexCommand implements ICommand {
  readonly name = 'reindex';
  readonly description = 'Reindex SQL database';

  constructor(private readonly reindexUseCase: ReindexDatabaseUseCase) {}

  async execute(args: string[]): Promise<string> {
    const saPassword = args[0];
    await this.reindexUseCase.execute(saPassword);
    return 'Database reindexing started';
  }
}
