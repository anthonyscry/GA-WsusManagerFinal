import { useState, useEffect } from 'react';
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { IJobManager, Job } from '../../application/jobs/IJobManager';
import { IEventBus } from '../../application/events/IEventBus';

/**
 * Hook for accessing background jobs
 */
export function useJobs() {
  const jobManager = useService<IJobManager>(TOKENS.JOB_MANAGER);
  const eventBus = useService<IEventBus>(TOKENS.EVENT_BUS);
  const [jobs, setJobs] = useState<Job[]>(jobManager.getJobs());

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('jobs.updated', () => {
      setJobs([...jobManager.getJobs()]);
    });

    return unsubscribe;
  }, [jobManager, eventBus]);

  return {
    jobs,
    getJob: (jobId: string) => jobManager.getJob(jobId)
  };
}
