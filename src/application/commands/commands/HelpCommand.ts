import { ICommand } from '../ICommandHandler';
import { ICommandHandler } from '../ICommandHandler';

/**
 * Help Command
 * Shows available commands
 */
export class HelpCommand implements ICommand {
  readonly name = 'help';
  readonly description = 'Show available commands';

  constructor(private readonly commandHandler: ICommandHandler) {}

  async execute(_args: string[]): Promise<string> {
    const commands = this.commandHandler.getAvailableCommands();
    if (commands.length === 0) {
      return 'No commands available';
    }
    
    return `Available commands: ${commands.join(', ')}`;
  }
}
