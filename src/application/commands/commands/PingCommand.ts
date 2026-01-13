import { ICommand } from '../ICommandHandler';
import { ValidationError } from '../../../domain/errors/ValidationError';

/**
 * Ping Command
 * Simulates network ping
 */
export class PingCommand implements ICommand {
  readonly name = 'ping';
  readonly description = 'Ping a hostname or IP address';

  async execute(args: string[]): Promise<string> {
    const target = args[0] || 'gateway';
    
    // Validate hostname
    if (!/^[a-zA-Z0-9.-]+$/.test(target)) {
      throw new ValidationError('Invalid hostname format', 'target');
    }
    
    if (target.length > 255) {
      throw new ValidationError('Hostname too long', 'target');
    }

    return `Pinging ${target} [10.0.0.1] with 32 bytes of data:\nReply from 10.0.0.1: bytes=32 time<1ms TTL=128`;
  }
}
