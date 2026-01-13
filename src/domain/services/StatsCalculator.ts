import { Computer } from '../entities/Computer';
import { EnvironmentStats } from '../entities/EnvironmentStats';
import { HealthStatus } from '../value-objects/HealthStatus';

/**
 * Stats Calculator Domain Service
 * Pure business logic for calculating statistics
 */
export class StatsCalculator {
  /**
   * Calculate stats from computer list
   */
  static calculateFromComputers(computers: Computer[]): {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
  } {
    const total = computers.length;
    const healthy = computers.filter(c => c.status === HealthStatus.HEALTHY).length;
    const warning = computers.filter(c => c.status === HealthStatus.WARNING).length;
    const critical = computers.filter(c => c.status === HealthStatus.CRITICAL).length;

    return { total, healthy, warning, critical };
  }

  /**
   * Calculate compliance percentage
   */
  static calculateCompliancePercentage(
    healthyCount: number,
    totalCount: number
  ): number {
    if (totalCount === 0) return 0;
    return Math.round((healthyCount / totalCount) * 100);
  }

  /**
   * Calculate average compliance across computers
   */
  static calculateAverageCompliance(computers: Computer[]): number {
    if (computers.length === 0) return 0;
    
    const totalCompliance = computers.reduce(
      (sum, computer) => sum + computer.compliancePercentage,
      0
    );
    
    return Math.round(totalCompliance / computers.length);
  }

  /**
   * Update environment stats with computer data
   */
  static updateStatsFromComputers(
    stats: EnvironmentStats,
    computers: Computer[]
  ): void {
    const calculated = this.calculateFromComputers(computers);
    stats.recalculateFromComputers(
      calculated.healthy,
      calculated.warning,
      calculated.critical,
      calculated.total
    );
  }

  /**
   * Check if stats indicate healthy environment
   */
  static isEnvironmentHealthy(stats: EnvironmentStats): boolean {
    return stats.isHealthy();
  }

  /**
   * Get health summary
   */
  static getHealthSummary(stats: EnvironmentStats): {
    isHealthy: boolean;
    needsAttention: boolean;
    compliancePercentage: number;
    criticalIssues: number;
  } {
    return {
      isHealthy: stats.isHealthy(),
      needsAttention: stats.needsAttention(),
      compliancePercentage: stats.compliancePercentage,
      criticalIssues: stats.criticalComputers
    };
  }
}
