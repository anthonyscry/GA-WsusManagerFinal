import { ICommand } from '../ICommandHandler';
import { IStatsRepository } from '../../../domain/repositories/IStatsRepository';

/**
 * Status Command
 * Shows system health status
 */
export class StatusCommand implements ICommand {
  readonly name = 'status';
  readonly description = 'Show system health status';

  constructor(private readonly statsRepo: IStatsRepository) {}

  async execute(args: string[]): Promise<string> {
    const stats = await this.statsRepo.get();
    return `Health: ${stats.healthyComputers} Nodes OK. DB: ${stats.db.currentSizeGB}GB`;
  }
}
