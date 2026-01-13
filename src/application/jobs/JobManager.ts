import { IJobManager, Job } from './IJobManager';
import { IEventBus } from '../events/IEventBus';
import { ILogger } from '../../infrastructure/logging/ILogger';
import { config } from '../../infrastructure/config';

/**
 * Job Manager Implementation
 * Manages background jobs with progress tracking
 */
export class JobManager implements IJobManager {
  private jobs: Job[] = [];
  private jobTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly maxConcurrentJobs = 10;
  private readonly maxJobDuration = 600000; // 10 minutes

  constructor(
    private readonly eventBus: IEventBus,
    private readonly logger: ILogger
  ) {}

  createJob(name: string, estimatedDurationMs: number): Job {
    if (this.jobs.length >= this.maxConcurrentJobs) {
      throw new Error('Maximum number of concurrent jobs reached');
    }

    if (estimatedDurationMs < 0 || estimatedDurationMs > this.maxJobDuration) {
      throw new Error(`Invalid job duration: ${estimatedDurationMs}ms`);
    }

    const jobId = this.generateJobId();
    const job: Job = {
      id: jobId,
      name,
      progress: 0,
      status: 'Running',
      startTime: Date.now()
    };

    this.jobs.push(job);
    this.startProgressTracking(jobId, estimatedDurationMs);
    this.eventBus.publish('job.created', { job });
    this.notify();

    return job;
  }

  updateProgress(jobId: string, progress: number): void {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.progress = Math.max(0, Math.min(100, progress));
    this.eventBus.publish('job.progress', { jobId, progress });
    this.notify();
  }

  complete(jobId: string): void {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    this.stopProgressTracking(jobId);
    job.status = 'Completed';
    job.progress = 100;
    
    this.eventBus.publish('job.completed', { job });
    
    // Auto-remove after delay
    setTimeout(() => {
      this.remove(jobId);
    }, 2000);
    
    this.notify();
  }

  fail(jobId: string): void {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    this.stopProgressTracking(jobId);
    job.status = 'Failed';
    
    this.eventBus.publish('job.failed', { job });
    this.notify();
  }

  getJobs(): Job[] {
    return [...this.jobs];
  }

  getJob(jobId: string): Job | null {
    return this.jobs.find(j => j.id === jobId) || null;
  }

  remove(jobId: string): void {
    this.stopProgressTracking(jobId);
    this.jobs = this.jobs.filter(j => j.id !== jobId);
    this.eventBus.publish('job.removed', { jobId });
    this.notify();
  }

  private startProgressTracking(jobId: string, durationMs: number): void {
    const interval = config.intervals.jobProgressUpdate;
    const steps = Math.max(1, Math.floor(durationMs / interval));
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const job = this.jobs.find(j => j.id === jobId);
      
      if (!job || job.status !== 'Running') {
        clearInterval(timer);
        this.jobTimers.delete(jobId);
        return;
      }
      
      if (currentStep >= steps) {
        // Don't auto-complete, let use case handle it
        clearInterval(timer);
        this.jobTimers.delete(jobId);
      } else {
        const progress = Math.min(95, (currentStep / steps) * 100);
        this.updateProgress(jobId, progress);
      }
    }, interval);

    this.jobTimers.set(jobId, timer);
  }

  private stopProgressTracking(jobId: string): void {
    const timer = this.jobTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.jobTimers.delete(jobId);
    }
  }

  private generateJobId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(36)).join('').slice(0, 11);
  }

  private notify(): void {
    // Notify listeners (similar to stateService pattern)
    this.eventBus.publish('jobs.updated', { jobs: this.getJobs() });
  }
}
