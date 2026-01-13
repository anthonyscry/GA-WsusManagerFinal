/**
 * Job Interface
 */
export interface Job {
  id: string;
  name: string;
  progress: number;
  status: 'Running' | 'Completed' | 'Failed';
  startTime: number;
}

/**
 * Job Manager Interface
 * Defines contract for background job management
 */
export interface IJobManager {
  /**
   * Create a new job
   */
  createJob(name: string, estimatedDurationMs: number): Job;

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: number): void;

  /**
   * Mark job as completed
   */
  complete(jobId: string): void;

  /**
   * Mark job as failed
   */
  fail(jobId: string): void;

  /**
   * Get all active jobs
   */
  getJobs(): Job[];

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | null;

  /**
   * Remove job
   */
  remove(jobId: string): void;
}
