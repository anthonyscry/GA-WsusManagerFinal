import { ITaskRepository } from '../../../domain/repositories/ITaskRepository';
import { ScheduledTask } from '../../../domain/entities/ScheduledTask';
import { IStorage } from '../storage/IStorage';
import { ILogger } from '../../logging/ILogger';
import { config } from '../../config';

/**
 * Task Repository Implementation
 * Uses storage adapter for persistence
 */
export class TaskRepository implements ITaskRepository {
  private readonly storageKey: string;

  constructor(
    private readonly storage: IStorage,
    private readonly logger: ILogger
  ) {
    this.storageKey = config.storage.keys.tasks;
  }

  async findAll(): Promise<ScheduledTask[]> {
    try {
      const data = await this.storage.get<Array<Record<string, unknown>>>(this.storageKey);
      if (!data || !Array.isArray(data)) {
        return [];
      }
      return data.map(item => ScheduledTask.fromJSON(item as Parameters<typeof ScheduledTask.fromJSON>[0]));
    } catch (error) {
      this.logger.error('Failed to load tasks', { error });
      return [];
    }
  }

  async findById(id: string): Promise<ScheduledTask | null> {
    const tasks = await this.findAll();
    return tasks.find(t => t.id === id) || null;
  }

  async findByStatus(status: 'Ready' | 'Running' | 'Disabled'): Promise<ScheduledTask[]> {
    const tasks = await this.findAll();
    return tasks.filter(t => t.status === status);
  }

  async save(task: ScheduledTask): Promise<void> {
    const tasks = await this.findAll();
    const index = tasks.findIndex(t => t.id === task.id);
    
    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    
    await this.storage.set(this.storageKey, tasks.map(t => t.toJSON()));
  }

  async delete(id: string): Promise<void> {
    const tasks = await this.findAll();
    const filtered = tasks.filter(t => t.id !== id);
    await this.storage.set(this.storageKey, filtered.map(t => t.toJSON()));
  }

  async count(): Promise<number> {
    const tasks = await this.findAll();
    return tasks.length;
  }
}
