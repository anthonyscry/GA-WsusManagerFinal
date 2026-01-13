# Refactoring Code Examples

This document provides concrete before/after examples of key refactoring transformations.

---

## Example 1: StateService → Use Cases + Repository

### BEFORE (Current - God Class)

```typescript
// services/stateService.ts (321 lines, 15+ methods)
class StateService {
  private stats: EnvironmentStats;
  private computers: WsusComputer[];
  private tasks: ScheduledTask[];
  private jobs: BackgroundJob[] = [];
  private listeners: Set<() => void> = new Set();
  private airGap: boolean = true;
  private useRealServices: boolean = false;

  constructor() {
    // Mixed concerns: initialization, persistence, service discovery
    localStorage.removeItem(STORAGE_KEY_STATS);
    this.stats = this.getEmptyStats();
    this.computers = [];
    this.initializeServices(); // Direct dependency
  }

  async refreshTelemetry() {
    // Mixed: business logic, I/O, error handling, state management
    if (this.useRealServices) {
      const stats = await wsusService.getStats(); // Direct singleton
      const computers = await wsusService.getComputers();
      if (stats) {
        const dbMetrics = await sqlService.getDatabaseMetrics();
        if (dbMetrics) {
          stats.db = dbMetrics;
        }
        this.stats = stats;
      }
      if (computers.length > 0) {
        this.computers = computers;
      }
    }
    this.notify(); // Side effect
  }

  async performBulkAction(ids: string[], action: 'PING' | 'SYNC' | 'RESET') {
    // Mixed: job management, business logic, I/O
    this.startJob(`Bulk ${action}`, 3500, async () => {
      if (this.useRealServices && action === 'SYNC') {
        for (const id of ids) {
          const computer = this.computers.find(c => c.id === id);
          if (!computer) continue;
          const success = await wsusService.forceComputerSync(computer.name);
          // ... more mixed logic
        }
      }
      this.recalculateStats();
      this.notify();
    });
  }
}

export const stateService = new StateService(); // Singleton
```

**Problems**:
- ❌ 12+ responsibilities in one class
- ❌ Cannot test without real services
- ❌ Tight coupling to singletons
- ❌ Mixed concerns (state, I/O, business logic, jobs)
- ❌ Hard to extend or modify

### AFTER (Refactored - Clean Architecture)

```typescript
// domain/repositories/IStatsRepository.ts
export interface IStatsRepository {
  get(): Promise<EnvironmentStats>;
  save(stats: EnvironmentStats): Promise<void>;
}

// domain/repositories/IComputerRepository.ts
export interface IComputerRepository {
  findAll(): Promise<Computer[]>;
  findById(id: string): Promise<Computer | null>;
  saveAll(computers: Computer[]): Promise<void>;
}

// application/use-cases/stats/RefreshTelemetryUseCase.ts
export class RefreshTelemetryUseCase {
  constructor(
    private readonly statsRepo: IStatsRepository,
    private readonly computerRepo: IComputerRepository,
    private readonly wsusClient: IWsusClient,
    private readonly sqlClient: ISqlClient,
    private readonly logger: ILogger,
    private readonly eventBus: IEventBus
  ) {}

  async execute(): Promise<void> {
    this.logger.info('Polling infrastructure for fresh telemetry...');
    
    try {
      const [stats, computers] = await Promise.all([
        this.wsusClient.getStats(),
        this.wsusClient.getComputers()
      ]);
      
      if (stats) {
        const dbMetrics = await this.sqlClient.getDatabaseMetrics();
        if (dbMetrics) {
          stats.db = dbMetrics;
        }
        await this.statsRepo.save(stats);
      }
      
      if (computers.length > 0) {
        await this.computerRepo.saveAll(computers);
      }
      
      this.eventBus.publish('telemetry.refreshed', { stats, computers });
    } catch (error) {
      this.logger.error('Error refreshing telemetry', { error });
      throw new ExternalServiceError(
        'Failed to refresh telemetry',
        'WSUS',
        { error }
      );
    }
  }
}

// application/use-cases/computers/BulkSyncComputersUseCase.ts
export class BulkSyncComputersUseCase {
  constructor(
    private readonly computerRepo: IComputerRepository,
    private readonly wsusClient: IWsusClient,
    private readonly jobManager: IJobManager,
    private readonly logger: ILogger
  ) {}

  async execute(computerIds: string[]): Promise<void> {
    const job = this.jobManager.createJob(
      `Bulk SYNC (${computerIds.length} Nodes)`,
      3500
    );

    try {
      const computers = await Promise.all(
        computerIds.map(id => this.computerRepo.findById(id))
      );

      const validComputers = computers.filter(
        (c): c is Computer => c !== null
      );

      for (const computer of validComputers) {
        const success = await this.wsusClient.forceComputerSync(
          computer.name
        );
        
        if (success) {
          computer.markSynced();
          await this.computerRepo.save(computer);
        }
      }

      job.complete();
    } catch (error) {
      job.fail();
      this.logger.error('Bulk sync failed', { error, computerIds });
      throw new ExternalServiceError(
        'Bulk sync operation failed',
        'WSUS',
        { error, computerIds }
      );
    }
  }
}
```

**Benefits**:
- ✅ Single Responsibility: Each use case does one thing
- ✅ Testable: All dependencies are interfaces
- ✅ No coupling: Dependencies injected
- ✅ Clear separation: Business logic separate from I/O
- ✅ Easy to extend: Add new use cases without modifying existing

---

## Example 2: Direct Service Import → Dependency Injection

### BEFORE (Current)

```typescript
// components/Dashboard.tsx
import { stateService } from '../services/stateService';
import { loggingService } from '../services/loggingService';

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const handleRunDiagnostics = () => {
    loggingService.warn('INTEGRITY_CHECK: Initializing...');
    // ... hard to test, tightly coupled
  };
}

// components/ComputersTable.tsx
import { stateService } from '../services/stateService';

const ComputersTable: React.FC<ComputersTableProps> = ({ computers }) => {
  const handleBulkAction = async (action: 'PING' | 'SYNC' | 'RESET') => {
    await stateService.performBulkAction(Array.from(selectedIds), action);
    // ... cannot test without real stateService
  };
}
```

**Problems**:
- ❌ Cannot mock services
- ❌ Cannot test components in isolation
- ❌ Tight coupling to singletons
- ❌ Hard to swap implementations

### AFTER (Refactored)

```typescript
// presentation/context/ServiceContext.tsx
import React, { createContext, useContext } from 'react';
import { Container } from '../../di/Container';
import { TOKENS } from '../../di/tokens';

const ServiceContext = createContext<Container | null>(null);

export const ServiceProvider: React.FC<{
  container: Container;
  children: React.ReactNode;
}> = ({ container, children }) => (
  <ServiceContext.Provider value={container}>
    {children}
  </ServiceContext.Provider>
);

export function useService<T>(token: string): T {
  const container = useContext(ServiceContext);
  if (!container) {
    throw new Error('ServiceProvider not found');
  }
  return container.resolve<T>(token);
}

// presentation/hooks/useRefreshTelemetry.ts
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { RefreshTelemetryUseCase } from '../../application/use-cases/stats/RefreshTelemetryUseCase';

export function useRefreshTelemetry() {
  const useCase = useService<RefreshTelemetryUseCase>(
    TOKENS.REFRESH_TELEMETRY_USE_CASE
  );
  const eventBus = useService<IEventBus>(TOKENS.EVENT_BUS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('telemetry.refreshed', () => {
      setIsRefreshing(false);
    });

    return unsubscribe;
  }, [eventBus]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await useCase.execute();
    } catch (error) {
      console.error('Failed to refresh telemetry', error);
      setIsRefreshing(false);
    }
  }, [useCase]);

  return { refresh, isRefreshing };
}

// components/Dashboard.tsx (Refactored)
import { useRefreshTelemetry } from '../hooks/useRefreshTelemetry';
import { useDiagnostics } from '../../hooks/useDiagnostics';

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const { refresh, isRefreshing } = useRefreshTelemetry();
  const { isDiagnosing, runDiagnostics } = useDiagnostics();

  // ... component logic
}
```

**Benefits**:
- ✅ Testable: Can inject mock services
- ✅ Flexible: Easy to swap implementations
- ✅ No coupling: Components don't know about concrete services
- ✅ Test example:

```typescript
// __tests__/components/Dashboard.test.tsx
describe('Dashboard', () => {
  it('refreshes telemetry when button clicked', async () => {
    const mockUseCase = {
      execute: jest.fn().mockResolvedValue(undefined)
    };
    
    const container = new Container();
    container.registerSingleton(TOKENS.REFRESH_TELEMETRY_USE_CASE, mockUseCase);
    
    render(
      <ServiceProvider container={container}>
        <Dashboard stats={mockStats} />
      </ServiceProvider>
    );
    
    fireEvent.click(screen.getByText('Refresh'));
    expect(mockUseCase.execute).toHaveBeenCalled();
  });
});
```

---

## Example 3: Error Handling Transformation

### BEFORE (Current)

```typescript
// services/stateService.ts
async refreshTelemetry() {
  if (this.useRealServices) {
    try {
      const stats = await wsusService.getStats();
      // ...
    } catch (error: any) {
      loggingService.error(`Error refreshing telemetry: ${error.message}`);
      // No error type, no context, no recovery strategy
    }
  }
}

// components/ComputersTable.tsx
const handleBulkAction = async (action: 'PING' | 'SYNC' | 'RESET') => {
  setIsProcessing(true);
  await stateService.performBulkAction(Array.from(selectedIds), action);
  // No error handling, no user feedback
  setTimeout(() => {
    setIsProcessing(false);
    setSelectedIds(new Set());
  }, 1000);
};
```

**Problems**:
- ❌ Generic error handling
- ❌ No error types
- ❌ No context
- ❌ No user feedback
- ❌ No recovery strategies

### AFTER (Refactored)

```typescript
// domain/errors/ExternalServiceError.ts
export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;

  constructor(
    message: string,
    public readonly service: string,
    context?: Record<string, unknown>
  ) {
    super(message, { service, ...context });
  }
}

// application/use-cases/stats/RefreshTelemetryUseCase.ts
async execute(): Promise<void> {
  this.logger.info('Polling infrastructure for fresh telemetry...');
  
  try {
    const [stats, computers] = await Promise.all([
      this.wsusClient.getStats(),
      this.wsusClient.getComputers()
    ]);
    
    // ... success logic
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      this.logger.error('External service error', {
        service: error.service,
        context: error.context
      });
      throw error; // Re-throw with context
    }
    
    throw new ExternalServiceError(
      'Failed to refresh telemetry',
      'WSUS',
      { originalError: error }
    );
  }
}

// presentation/hooks/useRefreshTelemetry.ts
export function useRefreshTelemetry() {
  const useCase = useService<RefreshTelemetryUseCase>(
    TOKENS.REFRESH_TELEMETRY_USE_CASE
  );
  const [error, setError] = useState<DomainError | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await useCase.execute();
    } catch (err) {
      if (err instanceof ExternalServiceError) {
        setError(err);
        // Show user-friendly message
        showNotification({
          type: 'error',
          message: `Failed to connect to ${err.service}. Please check your connection.`,
          details: err.message
        });
      } else {
        setError(new InternalError('An unexpected error occurred'));
      }
    }
  }, [useCase]);

  return { refresh, error };
}
```

**Benefits**:
- ✅ Typed errors with context
- ✅ User-friendly error messages
- ✅ Recovery strategies possible
- ✅ Better debugging with context
- ✅ Error handling at boundaries

---

## Example 4: Configuration Management

### BEFORE (Current)

```typescript
// Scattered throughout codebase
const STORAGE_KEY_STATS = 'wsus_pro_stats';
const STORAGE_KEY_COMPUTERS = 'wsus_pro_computers';
const UPDATE_INTERVAL_MS = 2000;
const DATA_POINT_LIMIT = 20;
const DATABASE_WARNING_THRESHOLD = 85;

// Hard-coded in components
setInterval(() => {
  // ...
}, 2000); // Magic number
```

**Problems**:
- ❌ Magic numbers everywhere
- ❌ No environment-based config
- ❌ Hard to change
- ❌ No validation

### AFTER (Refactored)

```typescript
// infrastructure/config/IConfig.ts
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
}

// infrastructure/config/Config.ts
export class Config implements IConfig {
  private static instance: Config;

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  get storage() {
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

  get intervals() {
    return {
      telemetryRefresh: this.getEnvNumber('TELEMETRY_REFRESH_INTERVAL', 30000),
      resourceMonitoring: this.getEnvNumber('RESOURCE_MONITORING_INTERVAL', 2000),
      throughputUpdate: this.getEnvNumber('THROUGHPUT_UPDATE_INTERVAL', 2000),
      jobProgressUpdate: this.getEnvNumber('JOB_PROGRESS_UPDATE_INTERVAL', 100),
    };
  }

  get thresholds() {
    return {
      databaseWarning: this.getEnvNumber('DATABASE_WARNING_THRESHOLD', 85),
      complianceWarning: this.getEnvNumber('COMPLIANCE_WARNING_THRESHOLD', 70),
      healthCheckDays: {
        healthy: this.getEnvNumber('HEALTHY_DAYS_THRESHOLD', 7),
        warning: this.getEnvNumber('WARNING_DAYS_THRESHOLD', 30),
      },
    };
  }

  private getEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
  }
}

// Usage
import { Config } from '../infrastructure/config/Config';

const config = Config.getInstance();
const interval = config.intervals.telemetryRefresh;

// In hooks
export function useResourceMonitoring() {
  const config = Config.getInstance();
  const interval = config.intervals.resourceMonitoring;
  
  useEffect(() => {
    const timer = setInterval(() => {
      // ...
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);
}
```

**Benefits**:
- ✅ Centralized configuration
- ✅ Environment-based overrides
- ✅ Type-safe access
- ✅ Easy to test with different configs
- ✅ No magic numbers

---

## Example 5: Testing Transformation

### BEFORE (Current - Untestable)

```typescript
// Cannot test - direct singleton dependencies
import { stateService } from '../services/stateService';

const Dashboard = () => {
  const stats = stateService.getStats(); // Real service, cannot mock
  const handleRefresh = () => {
    stateService.refreshTelemetry(); // Real service call
  };
};

// No way to test without:
// - Real WSUS server
// - Real database
// - Real localStorage
// - All services initialized
```

### AFTER (Refactored - Fully Testable)

```typescript
// __tests__/application/use-cases/RefreshTelemetryUseCase.test.ts
describe('RefreshTelemetryUseCase', () => {
  let useCase: RefreshTelemetryUseCase;
  let mockStatsRepo: jest.Mocked<IStatsRepository>;
  let mockComputerRepo: jest.Mocked<IComputerRepository>;
  let mockWsusClient: jest.Mocked<IWsusClient>;
  let mockSqlClient: jest.Mocked<ISqlClient>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockEventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    mockStatsRepo = createMockRepository();
    mockComputerRepo = createMockRepository();
    mockWsusClient = createMockWsusClient();
    mockSqlClient = createMockSqlClient();
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();

    useCase = new RefreshTelemetryUseCase(
      mockStatsRepo,
      mockComputerRepo,
      mockWsusClient,
      mockSqlClient,
      mockLogger,
      mockEventBus
    );
  });

  it('should refresh telemetry successfully', async () => {
    const mockStats = createMockStats();
    const mockComputers = [createMockComputer()];
    const mockDbMetrics = createMockDbMetrics();

    mockWsusClient.getStats.mockResolvedValue(mockStats);
    mockWsusClient.getComputers.mockResolvedValue(mockComputers);
    mockSqlClient.getDatabaseMetrics.mockResolvedValue(mockDbMetrics);

    await useCase.execute();

    expect(mockStatsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ db: mockDbMetrics })
    );
    expect(mockComputerRepo.saveAll).toHaveBeenCalledWith(mockComputers);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'telemetry.refreshed',
      expect.any(Object)
    );
  });

  it('should throw ExternalServiceError on WSUS failure', async () => {
    mockWsusClient.getStats.mockRejectedValue(new Error('Connection failed'));

    await expect(useCase.execute()).rejects.toThrow(ExternalServiceError);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

// __tests__/components/Dashboard.test.tsx
describe('Dashboard', () => {
  it('should display stats correctly', () => {
    const mockStats = createMockStats();
    const container = createTestContainer();

    render(
      <ServiceProvider container={container}>
        <Dashboard stats={mockStats} />
      </ServiceProvider>
    );

    expect(screen.getByText(`${mockStats.totalComputers}`)).toBeInTheDocument();
  });

  it('should refresh telemetry on button click', async () => {
    const container = createTestContainer();
    const mockUseCase = container.resolve<RefreshTelemetryUseCase>(
      TOKENS.REFRESH_TELEMETRY_USE_CASE
    );
    const executeSpy = jest.spyOn(mockUseCase, 'execute');

    render(
      <ServiceProvider container={container}>
        <Dashboard stats={createMockStats()} />
      </ServiceProvider>
    );

    fireEvent.click(screen.getByText('Refresh'));
    expect(executeSpy).toHaveBeenCalled();
  });
});
```

**Benefits**:
- ✅ Unit tests in isolation
- ✅ No external dependencies
- ✅ Fast test execution
- ✅ Easy to test edge cases
- ✅ Clear test intent

---

## Summary

These examples demonstrate the transformation from:
- **Tightly coupled** → **Loosely coupled**
- **Untestable** → **Fully testable**
- **Mixed concerns** → **Single responsibility**
- **Hard-coded** → **Configurable**
- **Ad-hoc errors** → **Structured error handling**

The refactored code follows SOLID principles, Clean Architecture, and industry best practices for maintainable, scalable software.
