/**
 * State Service - Modularized
 * 
 * @deprecated StateService is deprecated. Use the new architecture hooks instead:
 * - useStats() - for environment statistics
 * - useComputers() - for computer inventory
 * - useJobs() - for background jobs
 * - useRefreshTelemetry() - for refreshing data
 * - useBulkSync() - for bulk computer operations
 * - useMaintenance() - for maintenance operations
 * - useScheduledTasks() - for scheduled tasks
 * - useTerminalCommand() - for terminal commands
 * 
 * See docs/refactoring/MIGRATION_GUIDE.md for migration instructions.
 */

import { EnvironmentStats, WsusComputer, HealthStatus, ScheduledTask, StigCheck } from '../../types';
import { loggingService } from '../loggingService';
import { wsusService } from '../wsusService';
import { sqlService } from '../sqlService';

import { BackgroundJob, REFRESH_TIMEOUT_MS } from './types';
import { generateSecureId } from './utils';
import { JobManager } from './jobManager';
import { TerminalHandler } from './terminalHandler';
import { StigChecker } from './stigChecker';
import { StorageManager } from './storageManager';

// Re-export types
export type { BackgroundJob } from './types';

class StateService {
  private stats: EnvironmentStats;
  private computers: WsusComputer[];
  private tasks: ScheduledTask[];
  private listeners: Set<() => void> = new Set();
  private airGap: boolean = true;
  private useRealServices: boolean = false;
  private refreshLock: Promise<void> | null = null;
  private statsCacheTime: number = 0;

  // Modular components
  private jobManager: JobManager;
  private terminalHandler: TerminalHandler;
  private stigChecker: StigChecker;
  private storageManager: StorageManager;

  constructor() {
    // Initialize modular components
    this.jobManager = new JobManager();
    this.jobManager.setNotifyCallback(() => this.notify());
    
    this.stigChecker = new StigChecker();
    this.storageManager = new StorageManager();

    // Clear old localStorage data
    this.storageManager.clearAll();

    // Initialize with empty data
    this.stats = this.getEmptyStats();
    this.computers = [];
    this.tasks = [];

    // Terminal handler needs callbacks
    this.terminalHandler = new TerminalHandler(
      () => this.stats,
      () => this.reindexDatabase(),
      () => this.performCleanup()
    );

    // Initialize WSUS services
    this.initializeServices();
  }

  private getEmptyStats(): EnvironmentStats {
    return {
      totalComputers: 0,
      healthyComputers: 0,
      warningComputers: 0,
      criticalComputers: 0,
      totalUpdates: 0,
      securityUpdatesCount: 0,
      isInstalled: false,
      diskFreeGB: 0,
      automationStatus: 'Not Set',
      services: [
        { name: 'WSUS Service', status: 'Stopped', lastCheck: 'Never', type: 'WSUS' },
        { name: 'SQL Server (Express)', status: 'Stopped', lastCheck: 'Never', type: 'SQL' },
        { name: 'IIS (W3SVC)', status: 'Stopped', lastCheck: 'Never', type: 'IIS' }
      ],
      db: {
        currentSizeGB: 0,
        maxSizeGB: 10,
        instanceName: 'Not Connected',
        contentPath: 'N/A',
        lastBackup: 'Never'
      }
    };
  }

  private async initializeServices() {
    try {
      const initialized = await wsusService.initialize();
      this.useRealServices = initialized;
      if (initialized) {
        loggingService.info('Real WSUS services initialized - loading data...');
        await this.refreshTelemetry();
      } else {
        loggingService.error('WSUS services not available. Please ensure WSUS server is installed and running.');
        this.stats.isInstalled = false;
        this.notify();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Failed to initialize WSUS services: ${errorMessage}`);
      this.useRealServices = false;
      this.stats.isInstalled = false;
      this.notify();
    }
  }

  private notify() {
    try {
      this.listeners.forEach(l => {
        try {
          l();
        } catch (error) {
          loggingService.error('Listener error: ' + (error instanceof Error ? error.message : 'Unknown'));
        }
      });
      this.storageManager.debouncedPersist(this.stats, this.computers, this.tasks);
    } catch (error) {
      loggingService.error('Notify error: ' + (error instanceof Error ? error.message : 'Unknown'));
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // Getters
  getStats() { return { ...this.stats }; }
  getComputers() { return [...this.computers]; }
  getTasks() { return [...this.tasks]; }
  getJobs() { return this.jobManager.getJobs(); }
  isAirGap() { return this.airGap; }

  // Air-gap management
  setAirGap(val: boolean) {
    this.airGap = val;
    loggingService.warn(`[SYSTEM] Connectivity Mode Switched: ${val ? 'AIR-GAP (LOCAL)' : 'CLOUD-SYNC (CONNECTED)'}`);
    this.notify();
  }

  setAirGapFromConnectivity(isOnline: boolean) {
    if (!isOnline && !this.airGap) {
      loggingService.warn('[SYSTEM] Internet connection lost - automatically switching to AIR-GAP mode');
      this.airGap = true;
      this.notify();
    } else if (isOnline && this.airGap) {
      loggingService.info('[SYSTEM] Internet connection detected - automatically switching to CLOUD-SYNC mode');
      this.airGap = false;
      this.notify();
    }
  }

  // Delegate to modular components
  processTerminalCommand(cmd: string) {
    this.terminalHandler.processCommand(cmd);
  }

  startJob(name: string, durationMs?: number, onComplete?: () => void | Promise<void>): string {
    return this.jobManager.startJob(name, durationMs, onComplete);
  }

  cleanupJob(jobId: string) {
    this.jobManager.cleanupJob(jobId);
  }

  getStigChecks(): StigCheck[] {
    return this.stigChecker.getDefaultChecks();
  }

  async runStigComplianceChecks(): Promise<StigCheck[]> {
    return this.stigChecker.runComplianceChecks();
  }

  // Task management
  addTask(task: Omit<ScheduledTask, 'id' | 'status' | 'lastRun' | 'nextRun'>) {
    const newTask: ScheduledTask = {
      ...task,
      id: generateSecureId(),
      status: 'Ready',
      lastRun: 'Never',
      nextRun: 'Next Cycle'
    };
    this.tasks.push(newTask);
    this.notify();
    return newTask;
  }

  private getStatsAge(): number {
    return Date.now() - this.statsCacheTime;
  }

  // Telemetry
  async refreshTelemetry() {
    if (this.refreshLock) {
      await this.refreshLock;
      return;
    }
    
    this.refreshLock = (async () => {
      try {
        loggingService.info('Polling infrastructure for fresh telemetry...');
        
        if (this.useRealServices) {
          const refreshPromise = Promise.all([
            wsusService.getStats(),
            wsusService.getComputers()
          ]);
          
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Refresh timeout')), REFRESH_TIMEOUT_MS)
          );
          
          const [stats, computers] = await Promise.race([refreshPromise, timeoutPromise]);
          
          if (stats) {
            const dbMetrics = await sqlService.getDatabaseMetrics();
            if (dbMetrics) {
              stats.db = dbMetrics;
            }
            this.stats = stats;
            this.statsCacheTime = Date.now();
          }
          
          if (computers && computers.length > 0) {
            this.computers = computers;
          }
        } else {
          loggingService.warn('WSUS services not available - data will remain empty');
        }
        
        this.notify();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        loggingService.error(`Error refreshing telemetry: ${errorMessage}`);
        
        if (this.stats && this.getStatsAge() < 3600000) {
          loggingService.warn('Using cached data due to refresh failure');
          this.notify();
        } else {
          this.stats.isInstalled = false;
          this.notify();
        }
      } finally {
        this.refreshLock = null;
      }
    })();
    
    return this.refreshLock;
  }

  // Maintenance operations
  async performCleanup() {
    this.startJob('Deep Cleanup Engine', 4000, async () => {
      if (this.useRealServices) {
        try {
          const success = await wsusService.performCleanup();
          if (success) {
            const dbMetrics = await sqlService.getDatabaseMetrics();
            if (dbMetrics) {
              const oldSize = this.stats.db.currentSizeGB;
              this.stats.db = dbMetrics;
              loggingService.warn(`SUSDB Optimization: Reclaimed ${(oldSize - this.stats.db.currentSizeGB).toFixed(2)} GB.`);
            } else {
              loggingService.info('WSUS cleanup completed successfully.');
            }
          } else {
            loggingService.error('WSUS cleanup failed.');
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          loggingService.error(`Cleanup error: ${errorMessage}`);
        }
      } else {
        loggingService.error('WSUS services not available - cleanup cannot be performed');
      }
      this.notify();
    });
  }

  async reindexDatabase(saPassword?: string) {
    this.startJob('SQL Index Defragmentation', 5000, async () => {
      if (this.useRealServices) {
        try {
          const success = await sqlService.reindexDatabase(saPassword);
          if (success) {
            loggingService.info('SQL_SUCCESS: Index defragmentation completed.');
          } else {
            loggingService.error('SQL reindex failed.');
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          loggingService.error(`Reindex error: ${errorMessage}`);
        }
      } else {
        loggingService.error('WSUS services not available - database reindex cannot be performed');
      }
      this.notify();
    });
  }

  async performBulkAction(ids: string[], action: 'PING' | 'SYNC' | 'RESET') {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) {
      loggingService.error('Invalid IDs array');
      return;
    }
    
    for (const id of ids) {
      if (typeof id !== 'string' || id.length > 100) {
        loggingService.error(`Invalid ID: ${id}`);
        return;
      }
    }

    this.startJob(`Bulk ${action} (${ids.length} Nodes)`, 3500, async () => {
      if (this.useRealServices && action === 'SYNC') {
        loggingService.warn('Force sync not available - run wuauclt /detectnow on clients directly or use GPO');
        
        try {
          const computers = await wsusService.getComputers();
          if (computers && computers.length > 0) {
            this.computers = computers;
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          loggingService.error(`Failed to refresh computers: ${errorMessage}`);
        }
      } else {
        loggingService.error(`WSUS services not available - bulk ${action} action cannot be performed`);
      }
      if (this.useRealServices) {
        this.recalculateStats();
      }
      this.notify();
    });
  }

  private recalculateStats() {
    this.stats.totalComputers = this.computers.length;
    this.stats.healthyComputers = this.computers.filter(c => c.status === HealthStatus.HEALTHY).length;
    this.stats.warningComputers = this.computers.filter(c => c.status === HealthStatus.WARNING).length;
    this.stats.criticalComputers = this.computers.filter(c => c.status === HealthStatus.CRITICAL).length;
  }
}

export const stateService = new StateService();
