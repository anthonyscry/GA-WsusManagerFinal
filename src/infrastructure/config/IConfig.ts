/**
 * Configuration interface defining all application configuration
 */
export interface IConfig {
  storage: {
    keys: {
      stats: string;
      computers: string;
      tasks: string;
      logs: string;
    };
    maxLogs: number;
  };
  intervals: {
    telemetryRefresh: number;
    resourceMonitoring: number;
    throughputUpdate: number;
    jobProgressUpdate: number;
  };
  thresholds: {
    databaseWarning: number;
    complianceWarning: number;
    healthCheckDays: {
      healthy: number;
      warning: number;
    };
  };
  wsus: {
    defaultServer: string;
    defaultPort: number;
    defaultUseSsl: boolean;
  };
  features: {
    enableAIAssistant: boolean;
    enableAdvancedLogging: boolean;
  };
  diagnostics: {
    sequence: Array<{
      msg: string;
      delay: number;
    }>;
    totalDuration: number;
  };
  charts: {
    pieChart: {
      innerRadius: number;
      outerRadius: number;
      paddingAngle: number;
    };
    throughput: {
      dataPointLimit: number;
      minValue: number;
      maxValue: number;
    };
  };
}
