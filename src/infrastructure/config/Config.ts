import { IConfig } from './IConfig';

/**
 * Centralized configuration management
 * Supports environment variable overrides
 */
export class Config implements IConfig {
  private static instance: Config;

  /**
   * Get singleton instance of Config
   */
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Reset instance (useful for testing)
   */
  static reset(): void {
    Config.instance = new Config();
  }

  get storage(): IConfig['storage'] {
    return {
      keys: {
        stats: this.getEnv('STORAGE_KEY_STATS', 'wsus_pro_stats'),
        computers: this.getEnv('STORAGE_KEY_COMPUTERS', 'wsus_pro_computers'),
        tasks: this.getEnv('STORAGE_KEY_TASKS', 'wsus_pro_tasks'),
        logs: this.getEnv('STORAGE_KEY_LOGS', 'wsus_pro_logs'),
      },
      maxLogs: this.getEnvNumber('MAX_LOGS', 200),
    };
  }

  get intervals(): IConfig['intervals'] {
    return {
      telemetryRefresh: this.getEnvNumber('TELEMETRY_REFRESH_INTERVAL', 30000),
      resourceMonitoring: this.getEnvNumber('RESOURCE_MONITORING_INTERVAL', 2000),
      throughputUpdate: this.getEnvNumber('THROUGHPUT_UPDATE_INTERVAL', 2000),
      jobProgressUpdate: this.getEnvNumber('JOB_PROGRESS_UPDATE_INTERVAL', 100),
    };
  }

  get thresholds(): IConfig['thresholds'] {
    return {
      databaseWarning: this.getEnvNumber('DATABASE_WARNING_THRESHOLD', 85),
      complianceWarning: this.getEnvNumber('COMPLIANCE_WARNING_THRESHOLD', 70),
      healthCheckDays: {
        healthy: this.getEnvNumber('HEALTHY_DAYS_THRESHOLD', 7),
        warning: this.getEnvNumber('WARNING_DAYS_THRESHOLD', 30),
      },
    };
  }

  get wsus(): IConfig['wsus'] {
    return {
      defaultServer: this.getEnv('WSUS_SERVER', 'localhost'),
      defaultPort: this.getEnvNumber('WSUS_PORT', 8530),
      defaultUseSsl: this.getEnvBoolean('WSUS_USE_SSL', false),
    };
  }

  get features(): IConfig['features'] {
    return {
      enableAIAssistant: this.getEnvBoolean('ENABLE_AI_ASSISTANT', true),
      enableAdvancedLogging: this.getEnvBoolean('ENABLE_ADVANCED_LOGGING', false),
    };
  }

  get diagnostics(): IConfig['diagnostics'] {
    return {
      sequence: [
        { msg: 'SQL: PAGE_VERIFY bits confirmed.', delay: 800 },
        { msg: 'IIS: AppPool W3SVC recycling verified.', delay: 1600 },
        { msg: 'WSUS: SUSDB retrieval latencies within 5ms.', delay: 2400 },
        { msg: 'DISK: C:\\WSUS cluster alignment healthy.', delay: 3200 },
        { msg: 'DIAG_COMPLETE: System integrity verified.', delay: 4000 },
      ],
      totalDuration: 4500,
    };
  }

  get charts(): IConfig['charts'] {
    return {
      pieChart: {
        innerRadius: 70,
        outerRadius: 90,
        paddingAngle: 10,
      },
      throughput: {
        dataPointLimit: 20,
        minValue: 20,
        maxValue: 70,
      },
    };
  }

  /**
   * Get environment variable as string
   */
  private getEnv(key: string, defaultValue: string): string {
    // In Electron, process.env might not be available, use window.electronAPI if needed
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || defaultValue;
    }
    return defaultValue;
  }

  /**
   * Get environment variable as number
   */
  private getEnvNumber(key: string, defaultValue: number): number {
    const value = this.getEnv(key, '');
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get environment variable as boolean
   */
  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.getEnv(key, '');
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }
}

/**
 * Export singleton instance
 */
export const config = Config.getInstance();
