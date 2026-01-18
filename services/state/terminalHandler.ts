/**
 * Terminal command handler
 */

import { loggingService } from '../loggingService';
import { ALLOWED_COMMANDS, MAX_COMMANDS_PER_MINUTE } from './types';
import { validateHostname } from './utils';

export class TerminalHandler {
  private commandHistory: Map<string, number> = new Map();
  private getStatsCallback: () => { healthyComputers: number; db: { currentSizeGB: number } };
  private reindexCallback: () => void;
  private cleanupCallback: () => void;

  constructor(
    getStats: () => { healthyComputers: number; db: { currentSizeGB: number } },
    reindex: () => void,
    cleanup: () => void
  ) {
    this.getStatsCallback = getStats;
    this.reindexCallback = reindex;
    this.cleanupCallback = cleanup;
  }

  /**
   * Process terminal command with validation and rate limiting
   */
  processCommand(cmd: string): void {
    // Validate input length
    if (!cmd || cmd.length > 1000) {
      loggingService.error('Command exceeds maximum length');
      return;
    }

    // Rate limiting
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    // Clean old entries
    for (const [key, time] of this.commandHistory.entries()) {
      if (time < minuteAgo) this.commandHistory.delete(key);
    }
    
    if (this.commandHistory.size >= MAX_COMMANDS_PER_MINUTE) {
      loggingService.error('Rate limit exceeded. Please wait before executing more commands.');
      return;
    }
    
    this.commandHistory.set(cmd, now);

    const parts = cmd.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();
    
    if (!command || !ALLOWED_COMMANDS.has(command)) {
      loggingService.error(`Unknown command: '${cmd}'. Use 'help' for available commands.`);
      return;
    }
    
    const stats = this.getStatsCallback();
    
    switch (command) {
      case 'help':
        loggingService.info('Available: status, ping [name], reindex, cleanup, clear');
        break;
      case 'status':
        loggingService.info(`Health: ${stats.healthyComputers} Nodes OK. DB: ${stats.db.currentSizeGB}GB`);
        break;
      case 'ping': {
        const target = validateHostname(parts[1]);
        if (!target) {
          loggingService.error('Invalid hostname');
          return;
        }
        loggingService.info(`Pinging ${target} [10.0.0.1] with 32 bytes of data:`);
        setTimeout(() => loggingService.info(`Reply from 10.0.0.1: bytes=32 time<1ms TTL=128`), 400);
        break;
      }
      case 'clear':
        loggingService.clearLogs();
        break;
      case 'reindex':
        this.reindexCallback();
        break;
      case 'cleanup':
        this.cleanupCallback();
        break;
      default:
        loggingService.error(`Unknown command: '${cmd}'`);
    }
  }
}
