import { ScheduledTask } from '../entities/ScheduledTask';

/**
 * Task Repository Interface
 * Defines contract for scheduled task data access
 */
export interface ITaskRepository {
  /**
   * Find all tasks
   */
  findAll(): Promise<ScheduledTask[]>;

  /**
   * Find task by ID
   */
  findById(id: string): Promise<ScheduledTask | null>;

  /**
   * Find tasks by status
   */
  findByStatus(status: 'Ready' | 'Running' | 'Disabled'): Promise<ScheduledTask[]>;

  /**
   * Save a task
   */
  save(task: ScheduledTask): Promise<void>;

  /**
   * Delete task by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Count total tasks
   */
  count(): Promise<number>;
}
