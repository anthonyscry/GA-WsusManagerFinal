/**
 * Unit Tests for Job Manager Service
 * Tests background job lifecycle and management
 */

import { JobManager } from '../../../../services/state/jobManager';
import { MAX_CONCURRENT_JOBS, MAX_JOB_DURATION_MS } from '../../../../services/state/types';

// Mock loggingService
jest.mock('../../../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock the crypto for generateSecureId
const mockGetRandomValues = jest.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

Object.defineProperty(global, 'crypto', {
  value: { getRandomValues: mockGetRandomValues },
  writable: true,
});

describe('Job Manager Service', () => {
  let jobManager: JobManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jobManager = new JobManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // Constructor and Basic Setup
  // =========================================================================
  describe('initialization', () => {
    it('should start with empty jobs array', () => {
      expect(jobManager.getJobs()).toEqual([]);
    });

    it('should accept notify callback', () => {
      const callback = jest.fn();
      jobManager.setNotifyCallback(callback);
      
      // Callback should be called when job is started
      jobManager.startJob('Test Job', 1000);
      expect(callback).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // startJob() Tests
  // =========================================================================
  describe('startJob()', () => {
    
    describe('job creation', () => {
      it('should create job with correct properties', () => {
        const jobId = jobManager.startJob('Test Job', 1000);
        const jobs = jobManager.getJobs();
        
        expect(jobs).toHaveLength(1);
        expect(jobs[0].id).toBe(jobId);
        expect(jobs[0].name).toBe('Test Job');
        expect(jobs[0].progress).toBe(0);
        expect(jobs[0].status).toBe('Running');
        expect(jobs[0].startTime).toBeDefined();
      });

      it('should return unique job IDs', () => {
        const id1 = jobManager.startJob('Job 1', 1000);
        const id2 = jobManager.startJob('Job 2', 1000);
        
        expect(id1).not.toBe(id2);
      });

      it('should call notify callback on job start', () => {
        const callback = jest.fn();
        jobManager.setNotifyCallback(callback);
        
        jobManager.startJob('Test', 1000);
        
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('job progress', () => {
      it('should update progress over time', () => {
        jobManager.startJob('Progress Test', 1000);
        
        // Initial progress is 0
        expect(jobManager.getJobs()[0].progress).toBe(0);
        
        // Advance time partially
        jest.advanceTimersByTime(500);
        
        // Progress should be updated (not 0 anymore)
        expect(jobManager.getJobs()[0].progress).toBeGreaterThan(0);
        expect(jobManager.getJobs()[0].progress).toBeLessThan(100);
      });

      it('should complete job when duration elapses', () => {
        jobManager.startJob('Complete Test', 1000);
        
        // Advance time to completion
        jest.advanceTimersByTime(1100);
        
        const job = jobManager.getJobs()[0];
        expect(job.status).toBe('Completed');
        expect(job.progress).toBe(100);
      });

      it('should remove completed job after delay', () => {
        jobManager.startJob('Remove Test', 500);
        
        // Complete the job
        jest.advanceTimersByTime(600);
        expect(jobManager.getJobs()[0].status).toBe('Completed');
        
        // Wait for removal delay (2000ms in implementation)
        jest.advanceTimersByTime(2100);
        expect(jobManager.getJobs()).toHaveLength(0);
      });
    });

    describe('completion callback', () => {
      it('should call onComplete when job finishes', () => {
        const onComplete = jest.fn();
        
        jobManager.startJob('Callback Test', 500, onComplete);
        
        // Advance to completion
        jest.advanceTimersByTime(600);
        
        expect(onComplete).toHaveBeenCalled();
      });

      it('should handle async onComplete callback', async () => {
        const onComplete = jest.fn().mockResolvedValue(undefined);
        
        jobManager.startJob('Async Callback', 500, onComplete);
        
        jest.advanceTimersByTime(600);
        
        // Give promise time to resolve
        await Promise.resolve();
        
        expect(onComplete).toHaveBeenCalled();
      });

      it('should handle onComplete callback errors gracefully', () => {
        const onComplete = jest.fn().mockRejectedValue(new Error('Callback error'));
        
        // Should not throw
        expect(() => {
          jobManager.startJob('Error Callback', 500, onComplete);
          jest.advanceTimersByTime(600);
        }).not.toThrow();
      });
    });

    describe('validation', () => {
      it('should throw error for negative duration', () => {
        expect(() => {
          jobManager.startJob('Invalid', -1);
        }).toThrow('Invalid job duration');
      });

      it('should throw error for duration exceeding maximum', () => {
        expect(() => {
          jobManager.startJob('Too Long', MAX_JOB_DURATION_MS + 1);
        }).toThrow('Invalid job duration');
      });

      it('should accept zero duration', () => {
        expect(() => {
          jobManager.startJob('Zero Duration', 0);
        }).not.toThrow();
      });

      it('should accept maximum duration', () => {
        expect(() => {
          jobManager.startJob('Max Duration', MAX_JOB_DURATION_MS);
        }).not.toThrow();
      });
    });

    describe('concurrent jobs limit', () => {
      it('should throw error when max concurrent jobs reached', () => {
        // Start maximum number of jobs
        for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) {
          jobManager.startJob(`Job ${i}`, 10000);
        }
        
        expect(jobManager.getJobs()).toHaveLength(MAX_CONCURRENT_JOBS);
        
        // Try to start one more
        expect(() => {
          jobManager.startJob('One Too Many', 1000);
        }).toThrow('Maximum number of concurrent jobs reached');
      });

      it('should allow new job after previous completes', () => {
        // Start maximum jobs with short duration
        for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) {
          jobManager.startJob(`Job ${i}`, 500);
        }
        
        // Complete jobs and wait for cleanup
        jest.advanceTimersByTime(600);
        jest.advanceTimersByTime(2100);
        
        // Should be able to start new job
        expect(() => {
          jobManager.startJob('New Job', 1000);
        }).not.toThrow();
      });
    });
  });

  // =========================================================================
  // cleanupJob() Tests
  // =========================================================================
  describe('cleanupJob()', () => {
    
    it('should remove job from list', () => {
      const jobId = jobManager.startJob('Cleanup Test', 10000);
      expect(jobManager.getJobs()).toHaveLength(1);
      
      jobManager.cleanupJob(jobId);
      
      expect(jobManager.getJobs()).toHaveLength(0);
    });

    it('should clear job timer', () => {
      const callback = jest.fn();
      jobManager.setNotifyCallback(callback);
      
      const jobId = jobManager.startJob('Timer Test', 10000);
      const initialCallCount = callback.mock.calls.length;
      
      jobManager.cleanupJob(jobId);
      
      // Advance time - timer should not fire anymore
      jest.advanceTimersByTime(1000);
      
      // Only one more call from cleanup, not from timer
      expect(callback.mock.calls.length).toBe(initialCallCount + 1);
    });

    it('should call notify callback on cleanup', () => {
      const callback = jest.fn();
      jobManager.setNotifyCallback(callback);
      
      const jobId = jobManager.startJob('Notify Test', 10000);
      callback.mockClear();
      
      jobManager.cleanupJob(jobId);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should handle cleanup of non-existent job', () => {
      // Should not throw
      expect(() => {
        jobManager.cleanupJob('non-existent-id');
      }).not.toThrow();
    });

    it('should only remove specified job', () => {
      const job1 = jobManager.startJob('Job 1', 10000);
      const job2 = jobManager.startJob('Job 2', 10000);
      
      jobManager.cleanupJob(job1);
      
      const jobs = jobManager.getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(job2);
    });
  });

  // =========================================================================
  // getJobs() Tests
  // =========================================================================
  describe('getJobs()', () => {
    
    it('should return copy of jobs array', () => {
      jobManager.startJob('Test', 10000);
      
      const jobs1 = jobManager.getJobs();
      const jobs2 = jobManager.getJobs();
      
      expect(jobs1).not.toBe(jobs2); // Different array references
      expect(jobs1).toEqual(jobs2); // Same content
    });

    it('should not allow mutation of internal jobs', () => {
      jobManager.startJob('Test', 10000);
      
      const jobs = jobManager.getJobs();
      jobs.pop(); // Try to remove from returned array
      
      expect(jobManager.getJobs()).toHaveLength(1); // Original unchanged
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================
  describe('edge cases', () => {
    
    it('should handle job cleanup during progress update', () => {
      const jobId = jobManager.startJob('Race Test', 1000);
      
      // Advance partway
      jest.advanceTimersByTime(300);
      
      // Cleanup during progress
      jobManager.cleanupJob(jobId);
      
      // Continue advancing - should not error
      jest.advanceTimersByTime(1000);
      
      expect(jobManager.getJobs()).toHaveLength(0);
    });

    it('should handle multiple rapid job starts', () => {
      for (let i = 0; i < 5; i++) {
        jobManager.startJob(`Rapid ${i}`, 100);
      }
      
      expect(jobManager.getJobs()).toHaveLength(5);
    });
  });
});
