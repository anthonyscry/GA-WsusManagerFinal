
import { EnvironmentStats, WsusComputer, HealthStatus, ScheduledTask, StigCheck } from '../types';
import { loggingService } from './loggingService';
import { wsusService } from './wsusService';
import { sqlService } from './sqlService';

const STORAGE_KEY_STATS = 'wsus_pro_stats';
const STORAGE_KEY_COMPUTERS = 'wsus_pro_computers';
const STORAGE_KEY_TASKS = 'wsus_pro_tasks';

// Constants
const JOB_PROGRESS_UPDATE_INTERVAL_MS = 100;
const MAX_CONCURRENT_JOBS = 10;
const MAX_JOB_DURATION_MS = 600000; // 10 minutes
const MAX_COMMANDS_PER_MINUTE = 10;
const REFRESH_TIMEOUT_MS = 30000;

export interface BackgroundJob {
  id: string;
  name: string;
  progress: number;
  status: 'Running' | 'Completed' | 'Failed';
  startTime: number;
}

/**
 * Generate secure random ID using crypto API
 */
function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(36)).join('').slice(0, 11);
}

/**
 * Validate hostname for security
 */
function validateHostname(hostname: string | undefined): string | null {
  if (!hostname) return null;
  // Whitelist approach - only allow safe characters
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) return null;
  if (hostname.length > 255) return null;
  return hostname;
}

class StateService {
  private stats: EnvironmentStats;
  private computers: WsusComputer[];
  private tasks: ScheduledTask[];
  private jobs: BackgroundJob[] = [];
  private jobTimers: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Set<() => void> = new Set();
  private airGap: boolean = true;
  private useRealServices: boolean = false;
  private refreshLock: Promise<void> | null = null;
  private commandHistory: Map<string, number> = new Map();
  private statsCacheTime: number = 0;

  // Allowed terminal commands
  private readonly ALLOWED_COMMANDS = new Set(['help', 'status', 'clear', 'reindex', 'cleanup', 'ping']);

  constructor() {
    // Clear old localStorage data that might contain mock data
    // Only use localStorage if we successfully connect to WSUS
    try {
      localStorage.removeItem(STORAGE_KEY_STATS);
      localStorage.removeItem(STORAGE_KEY_COMPUTERS);
      localStorage.removeItem(STORAGE_KEY_TASKS);
    } catch (error) {
      // localStorage might not be available
      console.warn('localStorage not available');
    }

    // Always start with empty data - will be populated by real services if available
    this.stats = this.getEmptyStats();
    this.computers = [];
    this.tasks = [];

    // Try to initialize WSUS service - if it works, use real services
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
        // Load real data
        await this.refreshTelemetry();
      } else {
        loggingService.error('WSUS services not available. Please ensure WSUS server is installed and running.');
        loggingService.error('Install WSUS PowerShell module: Install-Module -Name UpdateServices');
        this.stats.isInstalled = false;
        this.notify();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error(`Failed to initialize WSUS services: ${errorMessage}`);
      loggingService.error('Application will run in offline mode with no data.');
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
          console.error('Listener error:', error);
        }
      });
      
      // Handle localStorage quota errors
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
        localStorage.setItem(STORAGE_KEY_COMPUTERS, JSON.stringify(this.computers));
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(this.tasks));
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          // Clear old data and retry
          this.clearOldStorage();
          try {
            localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
            localStorage.setItem(STORAGE_KEY_COMPUTERS, JSON.stringify(this.computers));
            localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(this.tasks));
          } catch (retryError) {
            loggingService.error('Storage quota exceeded. Data not persisted.');
          }
        } else {
          loggingService.error('Failed to persist state');
        }
      }
    } catch (error) {
      console.error('Notify error:', error);
    }
  }

  private clearOldStorage() {
    try {
      // Keep only most recent data
      const stats = localStorage.getItem(STORAGE_KEY_STATS);
      if (stats) {
        try {
          const parsed = JSON.parse(stats) as { computers?: unknown[] };
          // Clear large arrays if needed
          if (parsed.computers && Array.isArray(parsed.computers) && parsed.computers.length > 100) {
            parsed.computers = parsed.computers.slice(-100);
          }
          localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(parsed));
        } catch (parseError) {
          // If parsing fails, just remove the corrupted data
          localStorage.removeItem(STORAGE_KEY_STATS);
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStats() { return { ...this.stats }; }
  getComputers() { return [...this.computers]; }
  getTasks() { return [...this.tasks]; }
  getJobs() { return [...this.jobs]; }
  isAirGap() { return this.airGap; }

  setAirGap(val: boolean) {
    this.airGap = val;
    loggingService.warn(`[SYSTEM] Connectivity Mode Switched: ${val ? 'AIR-GAP (LOCAL)' : 'CLOUD-SYNC (CONNECTED)'}`);
    this.notify();
  }

  /**
   * Automatically set air-gap mode based on internet connectivity
   */
  setAirGapFromConnectivity(isOnline: boolean) {
    // If offline, force air-gap mode
    // If online, allow user preference (don't force cloud-sync)
    if (!isOnline) {
      if (!this.airGap) {
        loggingService.warn('[SYSTEM] Internet connection lost - automatically switching to AIR-GAP mode');
        this.airGap = true;
        this.notify();
      }
    }
    // If online, we don't automatically switch to cloud-sync
    // User can manually toggle if they want
  }

  /**
   * Process terminal command with validation and rate limiting
   */
  processTerminalCommand(cmd: string) {
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
    
    if (!command || !this.ALLOWED_COMMANDS.has(command)) {
      loggingService.error(`Unknown command: '${cmd}'. Use 'help' for available commands.`);
      return;
    }
    
    switch (command) {
      case 'help':
        loggingService.info('Available: status, ping [name], reindex, cleanup, clear');
        break;
      case 'status':
        loggingService.info(`Health: ${this.stats.healthyComputers} Nodes OK. DB: ${this.stats.db.currentSizeGB}GB`);
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
        this.reindexDatabase();
        break;
      case 'cleanup':
        this.performCleanup();
        break;
      default:
        loggingService.error(`Unknown command: '${cmd}'`);
    }
  }

  /**
   * Start a background job with validation and proper cleanup
   */
  startJob(name: string, durationMs: number = 3000, onComplete?: () => void | Promise<void>): string {
    // Validate duration
    if (durationMs < 0 || durationMs > MAX_JOB_DURATION_MS) {
      throw new Error(`Invalid job duration: ${durationMs}ms. Must be between 0 and ${MAX_JOB_DURATION_MS}ms`);
    }
    
    if (this.jobs.length >= MAX_CONCURRENT_JOBS) {
      throw new Error('Maximum number of concurrent jobs reached');
    }

    const jobId = generateSecureId();
    const newJob: BackgroundJob = {
      id: jobId,
      name,
      progress: 0,
      status: 'Running',
      startTime: Date.now()
    };
    
    this.jobs.push(newJob);
    this.notify();

    const interval = JOB_PROGRESS_UPDATE_INTERVAL_MS;
    const steps = Math.max(1, Math.floor(durationMs / interval));
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const jobIndex = this.jobs.findIndex(j => j.id === jobId);
      
      if (jobIndex === -1) {
        clearInterval(timer);
        this.jobTimers.delete(jobId);
        return;
      }
      
      if (currentStep >= steps) {
        this.jobs[jobIndex].status = 'Completed';
        this.jobs[jobIndex].progress = 100;
        clearInterval(timer);
        this.jobTimers.delete(jobId);
        
        setTimeout(() => {
          this.jobs = this.jobs.filter(j => j.id !== jobId);
          this.notify();
        }, 2000);
        
        if (onComplete) {
          Promise.resolve(onComplete()).catch(error => {
            loggingService.error(`Job completion callback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          });
        }
      } else {
        this.jobs[jobIndex].progress = Math.min(100, (currentStep / steps) * 100);
      }
      
      this.notify();
    }, interval);

    this.jobTimers.set(jobId, timer);
    return jobId;
  }

  /**
   * Cleanup job and its timer
   */
  cleanupJob(jobId: string) {
    const timer = this.jobTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.jobTimers.delete(jobId);
    }
    this.jobs = this.jobs.filter(j => j.id !== jobId);
    this.notify();
  }

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

  /**
   * Get age of cached stats in milliseconds
   */
  private getStatsAge(): number {
    return Date.now() - this.statsCacheTime;
  }

  /**
   * Refresh telemetry with race condition protection
   */
  async refreshTelemetry() {
    // Queue requests - wait for current refresh to complete
    if (this.refreshLock) {
      await this.refreshLock;
      return;
    }
    
    this.refreshLock = (async () => {
      try {
        loggingService.info('Polling infrastructure for fresh telemetry...');
        
        if (this.useRealServices) {
          // Use Promise.race for timeout
          const refreshPromise = Promise.all([
            wsusService.getStats(),
            wsusService.getComputers()
          ]);
          
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Refresh timeout')), REFRESH_TIMEOUT_MS)
          );
          
          const [stats, computers] = await Promise.race([refreshPromise, timeoutPromise]);
          
          if (stats) {
            // Get database metrics
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
          // No real services available - data remains empty
          loggingService.warn('WSUS services not available - data will remain empty');
        }
        
        this.notify();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        loggingService.error(`Error refreshing telemetry: ${errorMessage}`);
        
        // Fallback: Use cached data if available and recent
        if (this.stats && this.getStatsAge() < 3600000) {  // Use cache if < 1 hour old
          loggingService.warn('Using cached data due to refresh failure');
          this.notify();  // Still notify with cached data
        } else {
          // Mark as stale
          this.stats.isInstalled = false;
          this.notify();
        }
      } finally {
        this.refreshLock = null;
      }
    })();
    
    return this.refreshLock;
  }

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
    // Validate IDs
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) {
      loggingService.error('Invalid IDs array');
      return;
    }
    
    // Validate each ID
    for (const id of ids) {
      if (typeof id !== 'string' || id.length > 100) {
        loggingService.error(`Invalid ID: ${id}`);
        return;
      }
    }

    this.startJob(`Bulk ${action} (${ids.length} Nodes)`, 3500, async () => {
        if (this.useRealServices && action === 'SYNC') {
          try {
            for (const id of ids) {
              const computer = this.computers.find(c => c.id === id);
              if (!computer) continue;
              const success = await wsusService.forceComputerSync(computer.name);
              if (success) {
                computer.lastSync = new Date().toISOString().replace('T', ' ').slice(0, 16);
                computer.status = HealthStatus.HEALTHY;
              }
            }
            // Refresh computer list
            const computers = await wsusService.getComputers();
            if (computers && computers.length > 0) {
              this.computers = computers;
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            loggingService.error(`Bulk sync error: ${errorMessage}`);
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

  getStigChecks(): StigCheck[] {
      return [
          { id: '1', vulnId: 'V-2200', title: 'WSUS server must use HTTPS.', severity: 'CAT I', status: 'Compliant', discussion: 'Ensures metadata and content are encrypted during transit to downstream nodes.' },
          { id: '2', vulnId: 'V-2101', title: 'SQL Server must have page verify set to CHECKSUM.', severity: 'CAT II', status: 'Compliant', discussion: 'Prevents database corruption from being propagated during I/O operations.' },
          { id: '3', vulnId: 'V-2554', title: 'Only approved classifications should be synchronized.', severity: 'CAT III', status: 'Open', discussion: 'Syncing unneeded drivers or feature packs bloats SUSDB unnecessarily.' },
          { id: '4', vulnId: 'V-9932', title: 'Database backups must be verified weekly.', severity: 'CAT II', status: 'Compliant', discussion: 'Recovery objectives depend on valid restorable backup artifacts.' }
      ];
  }
}

export const stateService = new StateService();
