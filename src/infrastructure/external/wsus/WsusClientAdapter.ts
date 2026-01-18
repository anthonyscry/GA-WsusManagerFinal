import { IWsusClient } from './IWsusClient';
import { Computer } from '../../../domain/entities/Computer';
import { EnvironmentStats } from '../../../domain/entities/EnvironmentStats';
import { parseHealthStatus } from '../../../domain/value-objects/HealthStatus';
import { ILogger } from '../../logging/ILogger';
import { wsusService } from '../../../../services/wsusService';

/**
 * WSUS Client Adapter
 * Wraps existing wsusService to implement IWsusClient interface
 */
export class WsusClientAdapter implements IWsusClient {
  constructor(private readonly logger: ILogger) {}

  async initialize(server: string = 'localhost', port: number = 8530, useSsl: boolean = false): Promise<boolean> {
    try {
      return await wsusService.initialize(server, port, useSsl);
    } catch (error) {
      this.logger.error('WSUS initialization failed', { error, server, port, useSsl });
      return false;
    }
  }

  async getStats(): Promise<EnvironmentStats | null> {
    try {
      const stats = await wsusService.getStats();
      if (!stats) return null;

      // Convert to domain entity
      return new EnvironmentStats(
        stats.totalComputers || 0,
        stats.healthyComputers || 0,
        stats.warningComputers || 0,
        stats.criticalComputers || 0,
        stats.totalUpdates || 0,
        stats.securityUpdatesCount || 0,
        stats.services || [],
        stats.db,
        stats.isInstalled || false,
        stats.diskFreeGB || 0,
        stats.automationStatus || 'Not Set'
      );
    } catch (error) {
      this.logger.error('Failed to get WSUS stats', { error });
      return null;
    }
  }

  async getComputers(): Promise<Computer[]> {
    try {
      const computers = await wsusService.getComputers();
      return computers.map(c => this.toComputerEntity(c));
    } catch (error) {
      this.logger.error('Failed to get WSUS computers', { error });
      return [];
    }
  }

  async forceComputerSync(_computerName: string): Promise<boolean> {
    // NOTE: forceComputerSync removed - PsExec-based remote execution is a security risk
    // Users should run 'wuauclt /detectnow' or 'usoclient StartScan' directly on client machines
    this.logger.warn('forceComputerSync not available - run wuauclt /detectnow on client directly');
    return false;
  }

  async performCleanup(): Promise<boolean> {
    try {
      return await wsusService.performCleanup();
    } catch (error) {
      this.logger.error('Failed to perform WSUS cleanup', { error });
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toComputerEntity(data: any): Computer {
    const lastSync = data.lastSync && data.lastSync !== 'Never'
      ? new Date(data.lastSync)
      : new Date(0); // Use epoch if never synced

    return new Computer(
      data.id || '',
      data.name || 'Unknown',
      data.ipAddress || '0.0.0.0',
      data.os || 'Unknown OS',
      parseHealthStatus(data.status),
      lastSync,
      data.updatesNeeded || 0,
      data.updatesInstalled || 0,
      data.targetGroup || 'Default'
    );
  }
}
