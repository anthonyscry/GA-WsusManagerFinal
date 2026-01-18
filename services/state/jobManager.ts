/**
 * Background job management
 */

import { loggingService } from '../loggingService';
import { 
  BackgroundJob, 
  JOB_PROGRESS_UPDATE_INTERVAL_MS, 
  MAX_CONCURRENT_JOBS, 
  MAX_JOB_DURATION_MS 
} from './types';
import { generateSecureId } from './utils';

export class JobManager {
  private jobs: BackgroundJob[] = [];
  private jobTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private notifyCallback: () => void = () => {};

  setNotifyCallback(callback: () => void) {
    this.notifyCallback = callback;
  }

  getJobs(): BackgroundJob[] {
    return [...this.jobs];
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
    this.notifyCallback();

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
          this.notifyCallback();
        }, 2000);
        
        if (onComplete) {
          Promise.resolve(onComplete()).catch(error => {
            loggingService.error(`Job completion callback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          });
        }
      } else {
        this.jobs[jobIndex].progress = Math.min(100, (currentStep / steps) * 100);
      }
      
      this.notifyCallback();
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
    this.notifyCallback();
  }
}
