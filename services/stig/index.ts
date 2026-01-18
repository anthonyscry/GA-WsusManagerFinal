/**
 * STIG Service
 * Main entry point - re-exports all STIG functionality
 * Parses and manages DISA STIG files (XCCDF XML format)
 * Users can download official STIGs from: https://public.cyber.mil/stigs/downloads/
 */

import { loggingService } from '../loggingService';
import type { StigBenchmark, StigConfig, StigRule, ComplianceStats } from './types';
import { scanDirectory } from './scanner';
import { runComplianceChecks, applyComplianceResults, getComplianceStats } from './compliance';
import { exportResults } from './export';

// Re-export types
export * from './types';

// Re-export functions for direct use
export { scanDirectory } from './scanner';
export { parseXccdfFile, determineCheckType, generateGenericCheck } from './parser';
export { runComplianceChecks, applyComplianceResults, getComplianceStats } from './compliance';
export { exportResults, generateCsvContent } from './export';
export { checkMappings } from './checkMappings';

/**
 * STIG Service class
 * Provides stateful management of STIG benchmarks and configuration
 */
class StigService {
  private benchmarks: StigBenchmark[] = [];
  private config: StigConfig = {
    stigDirectory: 'C:\\STIG_Files',
    autoScanOnStartup: true
  };

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('stigConfig');
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      loggingService.error(`[STIG] Failed to load config: ${error}`);
    }
  }

  /**
   * Save configuration to localStorage
   */
  saveConfig(config: Partial<StigConfig>): void {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem('stigConfig', JSON.stringify(this.config));
      loggingService.info('[STIG] Configuration saved');
    } catch (error) {
      loggingService.error(`[STIG] Failed to save config: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): StigConfig {
    return { ...this.config };
  }

  /**
   * Get loaded benchmarks
   */
  getBenchmarks(): StigBenchmark[] {
    return [...this.benchmarks];
  }

  /**
   * Get all rules from all loaded benchmarks
   */
  getAllRules(): StigRule[] {
    return this.benchmarks.flatMap(b => b.rules);
  }

  /**
   * Scan STIG directory for XML/XCCDF files
   */
  async scanDirectory(): Promise<StigBenchmark[]> {
    this.benchmarks = await scanDirectory(this.config);
    
    this.config.lastScanDate = new Date().toISOString();
    this.saveConfig({});
    
    return this.benchmarks;
  }

  /**
   * Run compliance checks for all loaded rules (or specific benchmark)
   */
  async runComplianceChecks(benchmarkId?: string): Promise<StigRule[]> {
    const results = await runComplianceChecks(this.benchmarks, benchmarkId);
    
    // Update stored rules with results
    applyComplianceResults(this.benchmarks, results);
    
    return results;
  }

  /**
   * Export compliance results to CSV
   */
  async exportResults(outputPath: string): Promise<boolean> {
    return exportResults(this.getAllRules(), outputPath);
  }

  /**
   * Get compliance statistics
   */
  getComplianceStats(): ComplianceStats {
    return getComplianceStats(this.getAllRules());
  }
}

// Export singleton instance
export const stigService = new StigService();
