import { Computer } from '../entities/Computer';
import { HealthStatus } from '../value-objects/HealthStatus';

/**
 * Computer Repository Interface
 * Defines contract for computer data access
 */
export interface IComputerRepository {
  /**
   * Find all computers
   */
  findAll(): Promise<Computer[]>;

  /**
   * Find computer by ID
   */
  findById(id: string): Promise<Computer | null>;

  /**
   * Find computers by status
   */
  findByStatus(status: HealthStatus): Promise<Computer[]>;

  /**
   * Find computers by target group
   */
  findByTargetGroup(targetGroup: string): Promise<Computer[]>;

  /**
   * Save a single computer
   */
  save(computer: Computer): Promise<void>;

  /**
   * Save multiple computers
   */
  saveAll(computers: Computer[]): Promise<void>;

  /**
   * Delete computer by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Count total computers
   */
  count(): Promise<number>;

  /**
   * Count computers by status
   */
  countByStatus(status: HealthStatus): Promise<number>;
}
