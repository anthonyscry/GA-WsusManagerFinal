import { ITaskRepository } from '../../../domain/repositories/ITaskRepository';
import { ScheduledTask } from '../../../domain/entities/ScheduledTask';

/**
 * Get Scheduled Tasks Use Case
 * Retrieves all scheduled tasks
 */
export class GetScheduledTasksUseCase {
  constructor(private readonly taskRepo: ITaskRepository) {}

  async execute(): Promise<ScheduledTask[]> {
    return this.taskRepo.findAll();
  }
}
