import { IComputerRepository } from '../../../domain/repositories/IComputerRepository';
import { Computer } from '../../../domain/entities/Computer';
import { HealthStatus } from '../../../domain/value-objects/HealthStatus';
import { IStorage } from '../storage/IStorage';
import { ILogger } from '../../logging/ILogger';

/**
 * Computer Repository Implementation
 * Uses storage adapter for persistence
 */
export class ComputerRepository implements IComputerRepository {
  private readonly storageKey = 'computers';

  constructor(
    private readonly storage: IStorage,
    private readonly logger: ILogger
  ) {}

  async findAll(): Promise<Computer[]> {
    try {
      const data = await this.storage.get<Array<Record<string, unknown>>>(this.storageKey);
      if (!data || !Array.isArray(data)) {
        return [];
      }
      return data.map(item => Computer.fromJSON(item as Parameters<typeof Computer.fromJSON>[0]));
    } catch (error) {
      this.logger.error('Failed to load computers', { error });
      return [];
    }
  }

  async findById(id: string): Promise<Computer | null> {
    const computers = await this.findAll();
    return computers.find(c => c.id === id) || null;
  }

  async findByStatus(status: HealthStatus): Promise<Computer[]> {
    const computers = await this.findAll();
    return computers.filter(c => c.status === status);
  }

  async findByTargetGroup(targetGroup: string): Promise<Computer[]> {
    const computers = await this.findAll();
    return computers.filter(c => c.targetGroup === targetGroup);
  }

  async save(computer: Computer): Promise<void> {
    const computers = await this.findAll();
    const index = computers.findIndex(c => c.id === computer.id);
    
    if (index >= 0) {
      computers[index] = computer;
    } else {
      computers.push(computer);
    }
    
    await this.storage.set(this.storageKey, computers.map(c => c.toJSON()));
  }

  async saveAll(computers: Computer[]): Promise<void> {
    await this.storage.set(this.storageKey, computers.map(c => c.toJSON()));
  }

  async delete(id: string): Promise<void> {
    const computers = await this.findAll();
    const filtered = computers.filter(c => c.id !== id);
    await this.storage.set(this.storageKey, filtered.map(c => c.toJSON()));
  }

  async count(): Promise<number> {
    const computers = await this.findAll();
    return computers.length;
  }

  async countByStatus(status: HealthStatus): Promise<number> {
    const computers = await this.findByStatus(status);
    return computers.length;
  }
}
