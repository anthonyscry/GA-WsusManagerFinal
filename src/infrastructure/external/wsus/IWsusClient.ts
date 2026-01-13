import type { Computer } from '../../../domain/entities/Computer';
import type { EnvironmentStats } from '../../../domain/entities/EnvironmentStats';

/**
 * WSUS Client Interface
 * Defines contract for WSUS service operations
 */
export interface IWsusClient {
  /**
   * Initialize WSUS connection
   */
  initialize(server?: string, port?: number, useSsl?: boolean): Promise<boolean>;

  /**
   * Get environment statistics
   */
  getStats(): Promise<EnvironmentStats | null>;

  /**
   * Get all computers
   */
  getComputers(): Promise<Computer[]>;

  /**
   * Force computer sync
   */
  forceComputerSync(computerName: string): Promise<boolean>;

  /**
   * Perform cleanup
   */
  performCleanup(): Promise<boolean>;
}
