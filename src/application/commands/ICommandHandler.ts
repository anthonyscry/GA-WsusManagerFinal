/**
 * Command Handler Interface
 * Defines contract for command processing
 */
export interface ICommandHandler {
  /**
   * Execute a command
   */
  execute(input: string): Promise<string>;

  /**
   * Register a command
   */
  register(command: ICommand): void;

  /**
   * Get available commands
   */
  getAvailableCommands(): string[];
}

/**
 * Command Interface
 */
export interface ICommand {
  readonly name: string;
  readonly description: string;
  execute(args: string[]): Promise<string>;
}
