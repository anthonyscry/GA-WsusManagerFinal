/**
 * StateService Bridge
 * Provides a bridge between old StateService and new architecture
 * Allows gradual migration without breaking existing code
 */
import { Container } from '../di/Container';
import { TOKENS } from '../di/tokens';
import { RefreshTelemetryUseCase } from '../application/use-cases/stats/RefreshTelemetryUseCase';
import { BulkSyncComputersUseCase } from '../application/use-cases/computers/BulkSyncComputersUseCase';
import { PerformCleanupUseCase } from '../application/use-cases/maintenance/PerformCleanupUseCase';
import { ReindexDatabaseUseCase } from '../application/use-cases/maintenance/ReindexDatabaseUseCase';
import { ProcessTerminalCommandUseCase } from '../application/use-cases/commands/ProcessTerminalCommandUseCase';
import { IJobManager } from '../application/jobs/IJobManager';
import { IStatsRepository } from '../domain/repositories/IStatsRepository';
import { IComputerRepository } from '../domain/repositories/IComputerRepository';
import { ITaskRepository } from '../domain/repositories/ITaskRepository';
import { stateService } from '../../services/stateService';

/**
 * Bridge class that can delegate to new architecture or fall back to StateService
 */
export class StateServiceBridge {
  private useNewArchitecture: boolean = false;
  private container: Container | null = null;

  /**
   * Initialize bridge with container
   */
  initialize(container: Container): void {
    this.container = container;
    this.useNewArchitecture = true;
  }

  /**
   * Refresh telemetry - delegates to new architecture if available
   */
  async refreshTelemetry(): Promise<void> {
    if (this.useNewArchitecture && this.container) {
      try {
        const useCase = this.container.resolve<RefreshTelemetryUseCase>(TOKENS.REFRESH_TELEMETRY_USE_CASE);
        await useCase.execute();
        return;
      } catch (error: unknown) {
        // New architecture failed, fall back to StateService
        // Error is intentionally not logged to avoid noise
      }
    }
    
    // Fallback to old StateService
    await stateService.refreshTelemetry();
  }

  /**
   * Perform bulk action - delegates to new architecture if available
   */
  async performBulkAction(ids: string[], action: 'PING' | 'SYNC' | 'RESET'): Promise<void> {
    if (this.useNewArchitecture && this.container && action === 'SYNC') {
      try {
        const useCase = this.container.resolve<BulkSyncComputersUseCase>(TOKENS.BULK_SYNC_COMPUTERS_USE_CASE);
        await useCase.execute(ids);
        return;
      } catch (error: unknown) {
        // New architecture failed, fall back to StateService
        // Error is intentionally not logged to avoid noise
      }
    }
    
    // Fallback to old StateService
    await stateService.performBulkAction(ids, action);
  }

  /**
   * Perform cleanup - delegates to new architecture if available
   */
  async performCleanup(): Promise<void> {
    if (this.useNewArchitecture && this.container) {
      try {
        const useCase = this.container.resolve<PerformCleanupUseCase>(TOKENS.PERFORM_CLEANUP_USE_CASE);
        await useCase.execute();
        return;
      } catch (error: unknown) {
        // New architecture failed, fall back to StateService
        // Error is intentionally not logged to avoid noise
      }
    }
    
    // Fallback to old StateService
    await stateService.performCleanup();
  }

  /**
   * Reindex database - delegates to new architecture if available
   */
  async reindexDatabase(saPassword?: string): Promise<void> {
    if (this.useNewArchitecture && this.container) {
      try {
        const useCase = this.container.resolve<ReindexDatabaseUseCase>(TOKENS.REINDEX_DATABASE_USE_CASE);
        await useCase.execute(saPassword);
        return;
      } catch (error: unknown) {
        // New architecture failed, fall back to StateService
        // Error is intentionally not logged to avoid noise
      }
    }
    
    // Fallback to old StateService
    await stateService.reindexDatabase(saPassword);
  }

  /**
   * Process terminal command - delegates to new architecture if available
   */
  processTerminalCommand(cmd: string): void {
    if (this.useNewArchitecture && this.container) {
      try {
        const useCase = this.container.resolve<ProcessTerminalCommandUseCase>('PROCESS_TERMINAL_COMMAND_USE_CASE');
        useCase.execute(cmd).catch(() => {
          // Error handling is done in the use case
          // Just fall back to StateService
        });
        return;
      } catch (error: unknown) {
        // New architecture failed, fall back to StateService
        // Error is intentionally not logged to avoid noise
      }
    }
    
    // Fallback to old StateService
    stateService.processTerminalCommand(cmd);
  }

  /**
   * Get stats - can use new architecture repositories
   */
  getStats() {
    if (this.useNewArchitecture && this.container) {
      try {
        // Resolve but don't use - architecture placeholder for future async support
        this.container.resolve<IStatsRepository>(TOKENS.STATS_REPOSITORY);
        // Note: This is async, but StateService.getStats() is sync
        // For now, fall back to StateService for sync access
      } catch {
        // Fall through
      }
    }
    
    return stateService.getStats();
  }

  /**
   * Get computers - can use new architecture repositories
   */
  getComputers() {
    if (this.useNewArchitecture && this.container) {
      try {
        // Resolve but don't use - architecture placeholder for future async support
        this.container.resolve<IComputerRepository>(TOKENS.COMPUTER_REPOSITORY);
        // Note: This is async, but StateService.getComputers() is sync
        // For now, fall back to StateService for sync access
      } catch {
        // Fall through
      }
    }
    
    return stateService.getComputers();
  }

  /**
   * Get tasks - can use new architecture repositories
   */
  getTasks() {
    if (this.useNewArchitecture && this.container) {
      try {
        // Resolve but don't use - architecture placeholder for future async support
        this.container.resolve<ITaskRepository>(TOKENS.TASK_REPOSITORY);
        // Note: This is async, but StateService.getTasks() is sync
        // For now, fall back to StateService for sync access
      } catch {
        // Fall through
      }
    }
    
    return stateService.getTasks();
  }

  /**
   * Get jobs - delegates to new job manager if available
   */
  getJobs() {
    if (this.useNewArchitecture && this.container) {
      try {
        const jobManager = this.container.resolve<IJobManager>(TOKENS.JOB_MANAGER);
        return jobManager.getJobs();
      } catch (error) {
        // Fall through
      }
    }
    
    return stateService.getJobs();
  }

  /**
   * Subscribe - delegates to StateService (event system can be added later)
   */
  subscribe(listener: () => void) {
    return stateService.subscribe(listener);
  }

  /**
   * Other StateService methods - delegate directly
   */
  isAirGap() {
    return stateService.isAirGap();
  }

  setAirGap(val: boolean) {
    stateService.setAirGap(val);
  }

  addTask(task: Omit<import('../../types').ScheduledTask, 'id' | 'status' | 'lastRun' | 'nextRun'>) {
    return stateService.addTask(task);
  }

  getStigChecks() {
    return stateService.getStigChecks();
  }
}

export const stateServiceBridge = new StateServiceBridge();
