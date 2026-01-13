import { DatabaseMetrics } from '../value-objects/DatabaseMetrics';
import { HealthStatus } from '../value-objects/HealthStatus';

/**
 * Service State interface
 */
export interface ServiceState {
  name: string;
  status: 'Running' | 'Stopped' | 'Pending';
  lastCheck: string;
  type: 'WSUS' | 'SQL' | 'IIS';
}

/**
 * Environment Stats Domain Entity
 * Represents overall WSUS environment statistics
 */
export class EnvironmentStats {
  constructor(
    public totalComputers: number,
    public healthyComputers: number,
    public warningComputers: number,
    public criticalComputers: number,
    public totalUpdates: number,
    public securityUpdatesCount: number,
    public services: ServiceState[],
    public db: DatabaseMetrics,
    public isInstalled: boolean,
    public diskFreeGB: number,
    public automationStatus: 'Ready' | 'Not Set' | 'Running'
  ) {
    this.validate();
  }

  /**
   * Validate entity invariants
   */
  private validate(): void {
    if (this.totalComputers < 0) {
      throw new Error('Total computers cannot be negative');
    }
    if (this.healthyComputers < 0 || this.warningComputers < 0 || this.criticalComputers < 0) {
      throw new Error('Computer counts cannot be negative');
    }
    const sum = this.healthyComputers + this.warningComputers + this.criticalComputers;
    if (sum > this.totalComputers) {
      throw new Error('Sum of health status counts cannot exceed total computers');
    }
    if (this.diskFreeGB < 0) {
      throw new Error('Disk free space cannot be negative');
    }
  }

  /**
   * Calculate overall compliance percentage
   */
  get compliancePercentage(): number {
    if (this.totalComputers === 0) return 0;
    return Math.round((this.healthyComputers / this.totalComputers) * 100);
  }

  /**
   * Check if environment is healthy
   */
  isHealthy(): boolean {
    return this.compliancePercentage >= 90 && this.isInstalled;
  }

  /**
   * Check if environment needs attention
   */
  needsAttention(): boolean {
    return this.criticalComputers > 0 || this.compliancePercentage < 70;
  }

  /**
   * Get count of computers by status
   */
  getComputersByStatus(status: HealthStatus): number {
    switch (status) {
      case HealthStatus.HEALTHY:
        return this.healthyComputers;
      case HealthStatus.WARNING:
        return this.warningComputers;
      case HealthStatus.CRITICAL:
        return this.criticalComputers;
      default:
        return 0;
    }
  }

  /**
   * Recalculate stats from computer list
   * This would typically be called with a list of Computer entities
   */
  recalculateFromComputers(
    healthyCount: number,
    warningCount: number,
    criticalCount: number,
    totalCount: number
  ): void {
    this.totalComputers = totalCount;
    this.healthyComputers = healthyCount;
    this.warningComputers = warningCount;
    this.criticalComputers = criticalCount;
    this.validate();
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      totalComputers: this.totalComputers,
      healthyComputers: this.healthyComputers,
      warningComputers: this.warningComputers,
      criticalComputers: this.criticalComputers,
      totalUpdates: this.totalUpdates,
      securityUpdatesCount: this.securityUpdatesCount,
      services: this.services,
      db: this.db,
      isInstalled: this.isInstalled,
      diskFreeGB: this.diskFreeGB,
      automationStatus: this.automationStatus
    };
  }

  /**
   * Create empty stats
   */
  static empty(): EnvironmentStats {
    return new EnvironmentStats(
      0,
      0,
      0,
      0,
      0,
      0,
      [
        { name: 'WSUS Service', status: 'Stopped', lastCheck: 'Never', type: 'WSUS' },
        { name: 'SQL Server (Express)', status: 'Stopped', lastCheck: 'Never', type: 'SQL' },
        { name: 'IIS (W3SVC)', status: 'Stopped', lastCheck: 'Never', type: 'IIS' }
      ],
      {
        currentSizeGB: 0,
        maxSizeGB: 10,
        instanceName: 'Not Connected',
        contentPath: 'N/A',
        lastBackup: 'Never'
      },
      false,
      0,
      'Not Set'
    );
  }
}
