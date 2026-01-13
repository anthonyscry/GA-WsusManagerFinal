/**
 * Scheduled Task Domain Entity
 * Represents a scheduled automation task
 */
export class ScheduledTask {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly trigger: 'Daily' | 'Weekly' | 'Monthly',
    public readonly time: string,
    public status: 'Ready' | 'Running' | 'Disabled',
    public lastRun: string,
    public nextRun: string
  ) {
    this.validate();
  }

  /**
   * Validate entity invariants
   */
  private validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Task ID is required');
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Task name is required');
    }
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(this.time)) {
      throw new Error('Time must be in HH:MM format');
    }
  }

  /**
   * Check if task is ready to run
   */
  isReady(): boolean {
    return this.status === 'Ready';
  }

  /**
   * Check if task is disabled
   */
  isDisabled(): boolean {
    return this.status === 'Disabled';
  }

  /**
   * Mark task as running
   */
  markRunning(): void {
    this.status = 'Running';
  }

  /**
   * Mark task as completed
   */
  markCompleted(): void {
    this.status = 'Ready';
    this.lastRun = new Date().toISOString().replace('T', ' ').slice(0, 16);
    this.updateNextRun();
  }

  /**
   * Disable task
   */
  disable(): void {
    this.status = 'Disabled';
  }

  /**
   * Enable task
   */
  enable(): void {
    if (this.status === 'Disabled') {
      this.status = 'Ready';
    }
  }

  /**
   * Update next run time based on trigger
   */
  private updateNextRun(): void {
    const now = new Date();
    const next = new Date();

    switch (this.trigger) {
      case 'Daily':
        next.setDate(now.getDate() + 1);
        break;
      case 'Weekly':
        next.setDate(now.getDate() + 7);
        break;
      case 'Monthly':
        next.setMonth(now.getMonth() + 1);
        break;
    }

    const [hours, minutes] = this.time.split(':').map(Number);
    next.setHours(hours, minutes, 0, 0);

    this.nextRun = next.toISOString().replace('T', ' ').slice(0, 16);
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      trigger: this.trigger,
      time: this.time,
      status: this.status,
      lastRun: this.lastRun,
      nextRun: this.nextRun
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: {
    id: string;
    name: string;
    trigger: 'Daily' | 'Weekly' | 'Monthly';
    time: string;
    status: 'Ready' | 'Running' | 'Disabled';
    lastRun: string;
    nextRun: string;
  }): ScheduledTask {
    return new ScheduledTask(
      data.id,
      data.name,
      data.trigger,
      data.time,
      data.status,
      data.lastRun,
      data.nextRun
    );
  }
}
