/**
 * State service types and interfaces
 */

export interface BackgroundJob {
  id: string;
  name: string;
  progress: number;
  status: 'Running' | 'Completed' | 'Failed';
  startTime: number;
}

// Constants
export const JOB_PROGRESS_UPDATE_INTERVAL_MS = 100;
export const MAX_CONCURRENT_JOBS = 10;
export const MAX_JOB_DURATION_MS = 600000; // 10 minutes
export const MAX_COMMANDS_PER_MINUTE = 10;
export const REFRESH_TIMEOUT_MS = 30000;

export const STORAGE_KEY_STATS = 'wsus_pro_stats';
export const STORAGE_KEY_COMPUTERS = 'wsus_pro_computers';
export const STORAGE_KEY_TASKS = 'wsus_pro_tasks';

// Allowed terminal commands
export const ALLOWED_COMMANDS = new Set(['help', 'status', 'clear', 'reindex', 'cleanup', 'ping']);
