import { ITaskRepository } from '../../../domain/repositories/ITaskRepository';
import { ScheduledTask } from '../../../domain/entities/ScheduledTask';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { ValidationError } from '../../../domain/errors/ValidationError';

/**
 * Add Scheduled Task Use Case
 * Creates a new scheduled task
 */
export class AddScheduledTaskUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: {
    name: string;
    trigger: 'Daily' | 'Weekly' | 'Monthly';
    time: string;
  }): Promise<ScheduledTask> {
    // Validate input
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Task name is required', 'name');
    }

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input.time)) {
      throw new ValidationError('Time must be in HH:MM format', 'time');
    }

    // Generate ID
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const id = Array.from(array, byte => byte.toString(36)).join('').slice(0, 11);

    const task = new ScheduledTask(
      id,
      input.name,
      input.trigger,
      input.time,
      'Ready',
      'Never',
      'Next Cycle'
    );

    await this.taskRepo.save(task);
    this.logger.info(`Scheduled task created: ${task.name}`);

    return task;
  }
}
