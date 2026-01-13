import { ICommandHandler, ICommand } from './ICommandHandler';
import { ValidationError } from '../../domain/errors/ValidationError';

/**
 * Command Handler Implementation
 * Manages and executes terminal commands
 */
export class CommandHandler implements ICommandHandler {
  private commands = new Map<string, ICommand>();

  register(command: ICommand): void {
    this.commands.set(command.name.toLowerCase(), command);
  }

  async execute(input: string): Promise<string> {
    const parts = input.trim().toLowerCase().split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    if (!commandName) {
      throw new ValidationError('Command name is required', 'command');
    }

    const command = this.commands.get(commandName);
    if (!command) {
      const available = Array.from(this.commands.keys()).join(', ');
      throw new ValidationError(
        `Unknown command: '${commandName}'. Available: ${available || 'none'}`,
        'command'
      );
    }

    return command.execute(args);
  }

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }
}
