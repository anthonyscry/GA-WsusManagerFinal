import { IPowerShellExecutor } from './IPowerShellExecutor';
import { ILogger } from '../../logging/ILogger';
import { powershellService } from '../../../../services/powershellService';

/**
 * PowerShell Executor Adapter
 * Wraps existing powershellService to implement IPowerShellExecutor interface
 */
export class PowerShellExecutorAdapter implements IPowerShellExecutor {
  constructor(private readonly logger: ILogger) {}

  async execute(script: string, timeout?: number): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
  }> {
    try {
      const result = await powershellService.execute(script, timeout);
      return {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (error) {
      this.logger.error('PowerShell execution failed', { error, script: script.substring(0, 100) });
      return {
        success: false,
        stderr: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkModule(moduleName: string): Promise<boolean> {
    try {
      return await powershellService.checkModule(moduleName);
    } catch (error) {
      this.logger.error('Failed to check PowerShell module', { error, moduleName });
      return false;
    }
  }

  async importModule(moduleName: string): Promise<boolean> {
    try {
      const result = await powershellService.importModule(moduleName);
      return result.success;
    } catch (error) {
      this.logger.error('Failed to import PowerShell module', { error, moduleName });
      return false;
    }
  }
}
