import { HealthStatus, getHealthStatusFromLastSync } from '../value-objects/HealthStatus';

/**
 * Computer Domain Entity
 * Represents a WSUS-managed computer with business logic
 */
export class Computer {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly ipAddress: string,
    public readonly os: string,
    public status: HealthStatus,
    public lastSync: Date,
    public updatesNeeded: number,
    public updatesInstalled: number,
    public readonly targetGroup: string
  ) {
    this.validate();
  }

  /**
   * Validate entity invariants
   */
  private validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Computer ID is required');
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Computer name is required');
    }
    if (this.updatesNeeded < 0) {
      throw new Error('Updates needed cannot be negative');
    }
    if (this.updatesInstalled < 0) {
      throw new Error('Updates installed cannot be negative');
    }
  }

  /**
   * Calculate compliance percentage
   */
  get compliancePercentage(): number {
    const total = this.updatesInstalled + this.updatesNeeded;
    if (total === 0) return 100;
    return Math.round((this.updatesInstalled / total) * 100);
  }

  /**
   * Check if computer is healthy
   */
  isHealthy(): boolean {
    return this.status === HealthStatus.HEALTHY;
  }

  /**
   * Check if computer needs attention
   */
  needsAttention(): boolean {
    return this.status === HealthStatus.WARNING || this.status === HealthStatus.CRITICAL;
  }

  /**
   * Mark computer as synced
   */
  markSynced(): void {
    this.lastSync = new Date();
    this.status = HealthStatus.HEALTHY;
  }

  /**
   * Update sync status based on last sync time
   */
  updateSyncStatus(): void {
    this.status = getHealthStatusFromLastSync(this.lastSync);
  }

  /**
   * Apply updates installed
   */
  applyUpdates(count: number): void {
    if (count < 0) throw new Error('Update count cannot be negative');
    this.updatesInstalled += count;
    if (this.updatesNeeded >= count) {
      this.updatesNeeded -= count;
    } else {
      this.updatesNeeded = 0;
    }
  }

  /**
   * Mark updates as needed
   */
  markUpdatesNeeded(count: number): void {
    if (count < 0) throw new Error('Update count cannot be negative');
    this.updatesNeeded += count;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      ipAddress: this.ipAddress,
      os: this.os,
      status: this.status,
      lastSync: this.lastSync.toISOString(),
      updatesNeeded: this.updatesNeeded,
      updatesInstalled: this.updatesInstalled,
      targetGroup: this.targetGroup
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: {
    id: string;
    name: string;
    ipAddress: string;
    os: string;
    status: string;
    lastSync: string | Date;
    updatesNeeded: number;
    updatesInstalled: number;
    targetGroup: string;
  }): Computer {
    const lastSync = typeof data.lastSync === 'string' 
      ? new Date(data.lastSync) 
      : data.lastSync;
    
    return new Computer(
      data.id,
      data.name,
      data.ipAddress,
      data.os,
      HealthStatus[data.status as keyof typeof HealthStatus] || HealthStatus.UNKNOWN,
      lastSync,
      data.updatesNeeded,
      data.updatesInstalled,
      data.targetGroup
    );
  }
}
