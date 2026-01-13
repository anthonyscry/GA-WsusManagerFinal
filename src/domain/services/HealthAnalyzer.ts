import { Computer } from '../entities/Computer';
import { HealthStatus, getHealthStatusFromLastSync } from '../value-objects/HealthStatus';

/**
 * Health Analyzer Domain Service
 * Pure business logic for analyzing computer health
 */
export class HealthAnalyzer {
  /**
   * Analyze computer health based on multiple factors
   */
  static analyzeHealth(computer: Computer): {
    status: HealthStatus;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status = computer.status;

    // Check last sync
    const syncStatus = getHealthStatusFromLastSync(computer.lastSync);
    if (syncStatus === HealthStatus.CRITICAL) {
      issues.push('Computer has not synced in over 30 days');
      recommendations.push('Check network connectivity and WSUS server accessibility');
      status = HealthStatus.CRITICAL;
    } else if (syncStatus === HealthStatus.WARNING) {
      issues.push('Computer has not synced in over 7 days');
      recommendations.push('Verify computer is online and can reach WSUS server');
      if (status === HealthStatus.HEALTHY) {
        status = HealthStatus.WARNING;
      }
    }

    // Check updates needed
    if (computer.updatesNeeded > 50) {
      issues.push(`Computer has ${computer.updatesNeeded} pending updates`);
      recommendations.push('Schedule maintenance window to install updates');
      if (status === HealthStatus.HEALTHY) {
        status = HealthStatus.WARNING;
      }
    } else if (computer.updatesNeeded > 100) {
      issues.push(`Computer has ${computer.updatesNeeded} pending updates (critical)`);
      recommendations.push('Immediate action required: Install updates as soon as possible');
      status = HealthStatus.CRITICAL;
    }

    // Check compliance
    if (computer.compliancePercentage < 70) {
      issues.push(`Low compliance: ${computer.compliancePercentage}%`);
      recommendations.push('Review and install missing updates');
      if (status === HealthStatus.HEALTHY) {
        status = HealthStatus.WARNING;
      }
    }

    return { status, issues, recommendations };
  }

  /**
   * Get health score (0-100)
   */
  static getHealthScore(computer: Computer): number {
    let score = 100;

    // Deduct points for sync issues
    const syncStatus = getHealthStatusFromLastSync(computer.lastSync);
    if (syncStatus === HealthStatus.CRITICAL) score -= 50;
    else if (syncStatus === HealthStatus.WARNING) score -= 20;

    // Deduct points for updates
    if (computer.updatesNeeded > 100) score -= 30;
    else if (computer.updatesNeeded > 50) score -= 15;
    else if (computer.updatesNeeded > 10) score -= 5;

    // Deduct points for compliance
    if (computer.compliancePercentage < 70) score -= 20;
    else if (computer.compliancePercentage < 90) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if computer needs immediate attention
   */
  static needsImmediateAttention(computer: Computer): boolean {
    const analysis = this.analyzeHealth(computer);
    return analysis.status === HealthStatus.CRITICAL || analysis.issues.length > 2;
  }

  /**
   * Get priority level for computer
   */
  static getPriority(computer: Computer): 'Low' | 'Medium' | 'High' | 'Critical' {
    const score = this.getHealthScore(computer);
    
    if (score < 40) return 'Critical';
    if (score < 60) return 'High';
    if (score < 80) return 'Medium';
    return 'Low';
  }
}
