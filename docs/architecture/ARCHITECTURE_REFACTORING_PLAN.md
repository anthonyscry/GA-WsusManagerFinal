# Comprehensive Architecture Refactoring Plan
## GA-WsusManager Pro - Production-Grade Transformation

---

## 1. EXECUTIVE SUMMARY

### Current State Assessment

**Overall Score: 5.5/10**

#### Strengths
- ✅ TypeScript with type definitions
- ✅ React hooks for UI state management
- ✅ Separation of components and services
- ✅ Recent refactoring of hooks and utilities
- ✅ Clear domain model (types.ts)

#### Critical Issues
- ❌ **Singleton Pattern Anti-pattern**: All services are singletons, making testing impossible
- ❌ **God Class**: `StateService` has 15+ responsibilities (state, jobs, commands, persistence, orchestration)
- ❌ **Tight Coupling**: Direct imports of singleton services throughout codebase
- ❌ **No Dependency Injection**: Cannot mock or replace dependencies
- ❌ **Mixed Concerns**: Business logic, state management, persistence, and I/O all mixed
- ❌ **No Error Handling Strategy**: Ad-hoc error handling, no error hierarchy
- ❌ **No Configuration Management**: Hard-coded values, no environment-based config
- ❌ **No Abstraction Layers**: Direct dependencies on concrete implementations
- ❌ **Testing Challenges**: Cannot unit test due to singletons and tight coupling

### Recommended Architecture Pattern

**Clean Architecture / Hexagonal Architecture** with:
- **Domain Layer**: Core business logic and entities
- **Application Layer**: Use cases and orchestration
- **Infrastructure Layer**: External services, persistence, I/O
- **Presentation Layer**: React components and UI

**Patterns to Apply**:
- Dependency Injection Container
- Repository Pattern (data access)
- Service Layer Pattern (business logic)
- Command Pattern (terminal commands)
- Observer Pattern (state subscriptions)
- Factory Pattern (service creation)
- Strategy Pattern (AI providers, operation modes)

### Estimated Effort
- **Phase 1-3 (Foundation)**: 16-24 hours
- **Phase 4-6 (Core Refactoring)**: 32-40 hours
- **Phase 7-8 (Testing & Documentation)**: 24-32 hours
- **Total**: 72-96 hours (9-12 working days)

---

## 2. STRUCTURAL ANALYSIS

### Current Architecture Map

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                     │
│  App.tsx ──> Components (Dashboard, ComputersTable...)  │
└────────────────────┬──────────────────────────────────────┘
                     │ Direct imports
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   SERVICES LAYER                         │
│  stateService (Singleton) ──> wsusService (Singleton)    │
│  loggingService (Singleton) ──> sqlService (Singleton)  │
│  powershellService (Singleton)                           │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              EXTERNAL DEPENDENCIES                       │
│  PowerShell, SQL Server, WSUS API, localStorage         │
└─────────────────────────────────────────────────────────┘
```

### Complexity Metrics

| Component | Lines | Functions | Responsibilities | Coupling |
|-----------|-------|-----------|------------------|----------|
| `StateService` | 321 | 15+ | 12+ | High |
| `WsusService` | 270+ | 20+ | 8+ | Medium |
| `App.tsx` | 174 | 3 | 5+ | High |
| `Dashboard.tsx` | 205 | 2 | 4+ | Medium |

### Dependency Graph

**Current Dependencies** (Tight Coupling):
```
App.tsx
  ├─> stateService (singleton)
  └─> loggingService (singleton)

Dashboard.tsx
  ├─> hooks/* (good)
  ├─> utils/* (good)
  └─> services (via hooks - indirect)

StateService
  ├─> wsusService (singleton)
  ├─> sqlService (singleton)
  ├─> loggingService (singleton)
  └─> localStorage (direct)

All Services
  └─> Direct instantiation (no DI)
```

### Data Flow

```
User Action
  └─> Component
      └─> stateService.method()
          └─> wsusService.method()
              └─> PowerShell/API
                  └─> Response
                      └─> stateService.notify()
                          └─> Component re-render
```

**Issues**:
- No clear boundaries
- No error propagation strategy
- No transaction management
- No validation layer

---

## 3. PROPOSED MODULE STRUCTURE

### Target Architecture (Clean Architecture)

```
src/
├── domain/                          # Core business logic
│   ├── entities/                    # Domain entities
│   │   ├── Computer.ts
│   │   ├── EnvironmentStats.ts
│   │   ├── ScheduledTask.ts
│   │   └── index.ts
│   ├── value-objects/               # Immutable value objects
│   │   ├── HealthStatus.ts
│   │   ├── DatabaseMetrics.ts
│   │   └── index.ts
│   ├── repositories/                # Repository interfaces (contracts)
│   │   ├── IComputerRepository.ts
│   │   ├── IStatsRepository.ts
│   │   ├── ITaskRepository.ts
│   │   └── index.ts
│   ├── services/                    # Domain services (pure business logic)
│   │   ├── StatsCalculator.ts
│   │   ├── HealthAnalyzer.ts
│   │   └── index.ts
│   └── errors/                      # Domain errors
│       ├── DomainError.ts
│       ├── ValidationError.ts
│       └── index.ts
│
├── application/                     # Application layer (use cases)
│   ├── use-cases/                   # Business use cases
│   │   ├── computers/
│   │   │   ├── GetComputersUseCase.ts
│   │   │   ├── BulkSyncComputersUseCase.ts
│   │   │   └── index.ts
│   │   ├── stats/
│   │   │   ├── RefreshTelemetryUseCase.ts
│   │   │   └── index.ts
│   │   ├── maintenance/
│   │   │   ├── PerformCleanupUseCase.ts
│   │   │   ├── ReindexDatabaseUseCase.ts
│   │   │   └── index.ts
│   │   └── commands/
│   │       ├── ProcessTerminalCommandUseCase.ts
│   │       └── index.ts
│   ├── commands/                     # Command pattern
│   │   ├── ICommand.ts
│   │   ├── CommandHandler.ts
│   │   └── commands/
│   │       ├── StatusCommand.ts
│   │       ├── PingCommand.ts
│   │       └── index.ts
│   ├── jobs/                         # Background job management
│   │   ├── IJobManager.ts
│   │   ├── JobManager.ts
│   │   └── index.ts
│   └── events/                       # Event system
│       ├── IEventBus.ts
│       ├── EventBus.ts
│       └── index.ts
│
├── infrastructure/                   # External concerns
│   ├── persistence/                  # Data persistence
│   │   ├── repositories/            # Repository implementations
│   │   │   ├── LocalStorageRepository.ts
│   │   │   ├── ComputerRepository.ts
│   │   │   └── index.ts
│   │   └── storage/
│   │       ├── IStorage.ts
│   │       ├── LocalStorageAdapter.ts
│   │       └── index.ts
│   ├── external/                     # External services
│   │   ├── wsus/
│   │   │   ├── IWsusClient.ts
│   │   │   ├── WsusClient.ts
│   │   │   └── index.ts
│   │   ├── sql/
│   │   │   ├── ISqlClient.ts
│   │   │   ├── SqlClient.ts
│   │   │   └── index.ts
│   │   ├── powershell/
│   │   │   ├── IPowerShellExecutor.ts
│   │   │   ├── PowerShellExecutor.ts
│   │   │   └── index.ts
│   │   └── ai/
│   │       ├── providers/
│   │       │   ├── IAIProvider.ts
│   │       │   ├── GeminiProvider.ts
│   │       │   ├── ClaudeProvider.ts
│   │       │   └── index.ts
│   │       └── index.ts
│   ├── logging/                      # Logging infrastructure
│   │   ├── ILogger.ts
│   │   ├── Logger.ts
│   │   ├── LogLevel.ts
│   │   └── index.ts
│   └── config/                       # Configuration
│       ├── IConfig.ts
│       ├── Config.ts
│       ├── Environment.ts
│       └── index.ts
│
├── presentation/                     # UI layer
│   ├── components/                   # React components
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── index.ts
│   │   ├── ComputersTable/
│   │   │   ├── ComputersTable.tsx
│   │   │   └── index.ts
│   │   └── ... (other components)
│   ├── hooks/                        # React hooks
│   │   ├── useComputers.ts
│   │   ├── useStats.ts
│   │   └── ... (existing hooks)
│   ├── context/                      # React context
│   │   ├── AppContext.tsx
│   │   ├── ServiceContext.tsx
│   │   └── index.ts
│   └── providers/                   # Context providers
│       ├── ServiceProvider.tsx
│       └── index.ts
│
├── shared/                           # Shared utilities
│   ├── utils/                        # Pure utility functions
│   │   ├── calculations.ts
│   │   ├── formatters.ts
│   │   └── ... (existing utils)
│   ├── constants/                    # Constants
│   │   ├── dashboard.ts
│   │   ├── colors.ts
│   │   └── index.ts
│   └── types/                        # Shared types
│       └── index.ts
│
├── di/                               # Dependency Injection
│   ├── Container.ts                  # DI container
│   ├── tokens.ts                     # Injection tokens
│   └── index.ts
│
└── main.tsx                          # Application entry point
```

### Module Responsibility Matrix

| Module | Responsibility | Dependencies | Public API |
|--------|---------------|--------------|------------|
| `domain/entities` | Domain models | None | Entity classes |
| `domain/repositories` | Data access contracts | Entities | Repository interfaces |
| `domain/services` | Pure business logic | Entities | Service classes |
| `application/use-cases` | Orchestrate business flows | Domain, Infrastructure | Use case classes |
| `infrastructure/persistence` | Data storage | Domain, Storage | Repository implementations |
| `infrastructure/external` | External service clients | Domain, Config | Client interfaces |
| `presentation/components` | UI rendering | Application, Hooks | React components |
| `di/Container` | Dependency management | All layers | Container instance |

---

## 4. DETAILED REFACTORING PLAN

### Phase 1: Foundation - Configuration & Error Handling

#### 1.1 Create Configuration System

**Current**: Hard-coded values scattered
```typescript
// Current - scattered constants
const STORAGE_KEY_STATS = 'wsus_pro_stats';
const UPDATE_INTERVAL_MS = 2000;
```

**Refactored**: Centralized configuration
```typescript
// infrastructure/config/IConfig.ts
export interface IConfig {
  storage: {
    keys: {
      stats: string;
      computers: string;
      tasks: string;
    };
  };
  intervals: {
    telemetryRefresh: number;
    resourceMonitoring: number;
    throughputUpdate: number;
  };
  thresholds: {
    databaseWarning: number;
    complianceWarning: number;
  };
  wsus: {
    defaultInstance: string;
    defaultPort: number;
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
        stats: process.env.STORAGE_KEY_STATS || 'wsus_pro_stats',
        computers: process.env.STORAGE_KEY_COMPUTERS || 'wsus_pro_computers',
        tasks: process.env.STORAGE_KEY_TASKS || 'wsus_pro_tasks',
      }
    };
  }
  
  // ... other config sections
}
```

#### 1.2 Create Error Hierarchy

**Current**: Ad-hoc error handling
```typescript
// Current
catch (error: any) {
  loggingService.error(`Error: ${error.message}`);
}
```

**Refactored**: Structured error system
```typescript
// domain/errors/DomainError.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// domain/errors/ValidationError.ts
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

// domain/errors/NotFoundError.ts
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

// domain/errors/ExternalServiceError.ts
export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  
  constructor(
    message: string,
    public readonly service: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}
```

### Phase 2: Extract Domain Layer

#### 2.1 Extract Entities

**Current**: Types only, no behavior
```typescript
// types.ts
export interface WsusComputer {
  id: string;
  name: string;
  // ...
}
```

**Refactored**: Rich domain entities
```typescript
// domain/entities/Computer.ts
import { HealthStatus } from '../value-objects/HealthStatus';

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
  ) {}
  
  get compliancePercentage(): number {
    const total = this.updatesInstalled + this.updatesNeeded;
    return total > 0 ? (this.updatesInstalled / total) * 100 : 100;
  }
  
  isHealthy(): boolean {
    return this.status === HealthStatus.HEALTHY;
  }
  
  markSynced(): void {
    this.lastSync = new Date();
    this.status = HealthStatus.HEALTHY;
  }
}
```

#### 2.2 Create Repository Interfaces

```typescript
// domain/repositories/IComputerRepository.ts
import { Computer } from '../entities/Computer';

export interface IComputerRepository {
  findAll(): Promise<Computer[]>;
  findById(id: string): Promise<Computer | null>;
  findByStatus(status: HealthStatus): Promise<Computer[]>;
  save(computer: Computer): Promise<void>;
  saveAll(computers: Computer[]): Promise<void>;
  delete(id: string): Promise<void>;
}

// domain/repositories/IStatsRepository.ts
import { EnvironmentStats } from '../entities/EnvironmentStats';

export interface IStatsRepository {
  get(): Promise<EnvironmentStats>;
  save(stats: EnvironmentStats): Promise<void>;
}
```

### Phase 3: Create Infrastructure Layer

#### 3.1 Implement Repository Pattern

```typescript
// infrastructure/persistence/repositories/ComputerRepository.ts
import { IComputerRepository } from '../../../domain/repositories/IComputerRepository';
import { Computer } from '../../../domain/entities/Computer';
import { IStorage } from '../storage/IStorage';
import { ILogger } from '../../logging/ILogger';

export class ComputerRepository implements IComputerRepository {
  constructor(
    private readonly storage: IStorage,
    private readonly logger: ILogger
  ) {}
  
  async findAll(): Promise<Computer[]> {
    try {
      const data = await this.storage.get<ComputerData[]>('computers');
      return data.map(this.toEntity);
    } catch (error) {
      this.logger.error('Failed to load computers', { error });
      return [];
    }
  }
  
  private toEntity(data: ComputerData): Computer {
    return new Computer(
      data.id,
      data.name,
      data.ipAddress,
      data.os,
      HealthStatus.fromString(data.status),
      new Date(data.lastSync),
      data.updatesNeeded,
      data.updatesInstalled,
      data.targetGroup
    );
  }
  
  // ... other methods
}
```

#### 3.2 Abstract External Services

```typescript
// infrastructure/external/wsus/IWsusClient.ts
import { Computer } from '../../../domain/entities/Computer';
import { EnvironmentStats } from '../../../domain/entities/EnvironmentStats';

export interface IWsusClient {
  initialize(): Promise<boolean>;
  getStats(): Promise<EnvironmentStats | null>;
  getComputers(): Promise<Computer[]>;
  forceComputerSync(computerName: string): Promise<boolean>;
  performCleanup(): Promise<boolean>;
}

// infrastructure/external/wsus/WsusClient.ts
import { IWsusClient } from './IWsusClient';
import { IPowerShellExecutor } from '../powershell/IPowerShellExecutor';
import { ILogger } from '../../logging/ILogger';

export class WsusClient implements IWsusClient {
  constructor(
    private readonly powershell: IPowerShellExecutor,
    private readonly logger: ILogger
  ) {}
  
  async initialize(): Promise<boolean> {
    try {
      const result = await this.powershell.execute(
        'Get-Module -ListAvailable -Name UpdateServices'
      );
      return result.success;
    } catch (error) {
      this.logger.error('WSUS initialization failed', { error });
      return false;
    }
  }
  
  // ... other methods
}
```

### Phase 4: Create Application Layer (Use Cases)

#### 4.1 Extract Use Cases from StateService

**Current**: All logic in StateService
```typescript
// Current - stateService.ts
async refreshTelemetry() {
  if (this.useRealServices) {
    const stats = await wsusService.getStats();
    // ... mixed concerns
  }
}
```

**Refactored**: Focused use cases
```typescript
// application/use-cases/stats/RefreshTelemetryUseCase.ts
import { IStatsRepository } from '../../../domain/repositories/IStatsRepository';
import { IComputerRepository } from '../../../domain/repositories/IComputerRepository';
import { IWsusClient } from '../../../infrastructure/external/wsus/IWsusClient';
import { ISqlClient } from '../../../infrastructure/external/sql/ISqlClient';
import { ILogger } from '../../../infrastructure/logging/ILogger';
import { IEventBus } from '../../events/IEventBus';

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
```

#### 4.2 Command Pattern for Terminal

```typescript
// application/commands/ICommand.ts
export interface ICommand {
  execute(args: string[]): Promise<string>;
  readonly name: string;
  readonly description: string;
}

// application/commands/commands/StatusCommand.ts
export class StatusCommand implements ICommand {
  readonly name = 'status';
  readonly description = 'Show system health status';
  
  constructor(
    private readonly statsRepo: IStatsRepository
  ) {}
  
  async execute(args: string[]): Promise<string> {
    const stats = await this.statsRepo.get();
    return `Health: ${stats.healthyComputers} Nodes OK. DB: ${stats.db.currentSizeGB}GB`;
  }
}

// application/commands/CommandHandler.ts
export class CommandHandler {
  private commands = new Map<string, ICommand>();
  
  register(command: ICommand): void {
    this.commands.set(command.name, command);
  }
  
  async execute(input: string): Promise<string> {
    const [name, ...args] = input.trim().toLowerCase().split(/\s+/);
    const command = this.commands.get(name);
    
    if (!command) {
      throw new ValidationError(`Unknown command: '${name}'`);
    }
    
    return command.execute(args);
  }
}
```

### Phase 5: Dependency Injection Container

```typescript
// di/Container.ts
export class Container {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();
  
  register<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }
  
  registerSingleton<T>(token: string, instance: T): void {
    this.services.set(token, instance);
  }
  
  resolve<T>(token: string): T {
    if (this.services.has(token)) {
      return this.services.get(token);
    }
    
    if (this.factories.has(token)) {
      const instance = this.factories.get(token)!();
      this.services.set(token, instance);
      return instance;
    }
    
    throw new Error(`Service not found: ${token}`);
  }
}

// di/tokens.ts
export const TOKENS = {
  // Repositories
  COMPUTER_REPOSITORY: 'COMPUTER_REPOSITORY',
  STATS_REPOSITORY: 'STATS_REPOSITORY',
  
  // External Services
  WSUS_CLIENT: 'WSUS_CLIENT',
  SQL_CLIENT: 'SQL_CLIENT',
  POWERSHELL_EXECUTOR: 'POWERSHELL_EXECUTOR',
  
  // Application Services
  LOGGER: 'LOGGER',
  EVENT_BUS: 'EVENT_BUS',
  JOB_MANAGER: 'JOB_MANAGER',
  
  // Use Cases
  REFRESH_TELEMETRY_USE_CASE: 'REFRESH_TELEMETRY_USE_CASE',
  // ... more tokens
} as const;

// di/index.ts - Bootstrap container
export function createContainer(): Container {
  const container = new Container();
  
  // Register infrastructure
  container.registerSingleton(TOKENS.LOGGER, new Logger());
  container.registerSingleton(TOKENS.EVENT_BUS, new EventBus());
  
  // Register storage
  const storage = new LocalStorageAdapter();
  container.registerSingleton('STORAGE', storage);
  
  // Register repositories
  container.register(TOKENS.COMPUTER_REPOSITORY, () => 
    new ComputerRepository(
      container.resolve('STORAGE'),
      container.resolve(TOKENS.LOGGER)
    )
  );
  
  // Register external services
  container.register(TOKENS.WSUS_CLIENT, () =>
    new WsusClient(
      container.resolve(TOKENS.POWERSHELL_EXECUTOR),
      container.resolve(TOKENS.LOGGER)
    )
  );
  
  // Register use cases
  container.register(TOKENS.REFRESH_TELEMETRY_USE_CASE, () =>
    new RefreshTelemetryUseCase(
      container.resolve(TOKENS.STATS_REPOSITORY),
      container.resolve(TOKENS.COMPUTER_REPOSITORY),
      container.resolve(TOKENS.WSUS_CLIENT),
      container.resolve(TOKENS.SQL_CLIENT),
      container.resolve(TOKENS.LOGGER),
      container.resolve(TOKENS.EVENT_BUS)
    )
  );
  
  return container;
}
```

### Phase 6: Refactor Presentation Layer

#### 6.1 Create Service Context

```typescript
// presentation/context/ServiceContext.tsx
import React, { createContext, useContext } from 'react';
import { Container } from '../../di/Container';

const ServiceContext = createContext<Container | null>(null);

export const ServiceProvider: React.FC<{ container: Container; children: React.ReactNode }> = ({
  container,
  children
}) => {
  return (
    <ServiceContext.Provider value={container}>
      {children}
    </ServiceContext.Provider>
  );
};

export function useService<T>(token: string): T {
  const container = useContext(ServiceContext);
  if (!container) {
    throw new Error('ServiceProvider not found');
  }
  return container.resolve<T>(token);
}
```

#### 6.2 Refactor Components to Use DI

**Current**: Direct singleton import
```typescript
// Current
import { stateService } from '../services/stateService';

const Dashboard = () => {
  const stats = stateService.getStats();
}
```

**Refactored**: Dependency injection
```typescript
// Refactored
import { useService } from '../context/ServiceContext';
import { TOKENS } from '../../di/tokens';
import { IStatsRepository } from '../../domain/repositories/IStatsRepository';

const Dashboard = () => {
  const statsRepo = useService<IStatsRepository>(TOKENS.STATS_REPOSITORY);
  const [stats, setStats] = useState<EnvironmentStats | null>(null);
  
  useEffect(() => {
    statsRepo.get().then(setStats);
  }, [statsRepo]);
}
```

---

## 5. MIGRATION ROADMAP

### Phase 1: Foundation (Week 1)
- [ ] Day 1-2: Create configuration system
- [ ] Day 2-3: Create error hierarchy
- [ ] Day 3-4: Set up DI container structure
- [ ] **Checkpoint**: Config and errors working, DI container created

### Phase 2: Domain Layer (Week 2)
- [ ] Day 1-2: Extract entities from types
- [ ] Day 2-3: Create repository interfaces
- [ ] Day 3-4: Create domain services
- [ ] **Checkpoint**: Domain layer complete, no dependencies on infrastructure

### Phase 3: Infrastructure Layer (Week 2-3)
- [ ] Day 1-2: Implement storage abstraction
- [ ] Day 2-3: Implement repository implementations
- [ ] Day 3-4: Abstract external services (WSUS, SQL, PowerShell)
- [ ] Day 4-5: Implement logging infrastructure
- [ ] **Checkpoint**: All external dependencies abstracted

### Phase 4: Application Layer (Week 3-4)
- [ ] Day 1-2: Extract use cases from StateService
- [ ] Day 2-3: Implement command pattern
- [ ] Day 3-4: Create job manager
- [ ] Day 4-5: Create event bus
- [ ] **Checkpoint**: All business logic in use cases

### Phase 5: Dependency Injection (Week 4)
- [ ] Day 1-2: Wire up DI container
- [ ] Day 2-3: Register all services
- [ ] Day 3-4: Create service context/provider
- [ ] **Checkpoint**: DI working, services injectable

### Phase 6: Presentation Refactoring (Week 4-5)
- [ ] Day 1-2: Refactor App.tsx to use DI
- [ ] Day 2-3: Refactor Dashboard component
- [ ] Day 3-4: Refactor ComputersTable component
- [ ] Day 4-5: Refactor remaining components
- [ ] **Checkpoint**: All components using DI

### Phase 7: Testing (Week 5-6)
- [ ] Day 1-2: Unit tests for domain layer
- [ ] Day 2-3: Unit tests for use cases
- [ ] Day 3-4: Integration tests for repositories
- [ ] Day 4-5: Component tests with mocked services
- [ ] **Checkpoint**: 70%+ test coverage

### Phase 8: Documentation & Cleanup (Week 6)
- [ ] Day 1-2: API documentation
- [ ] Day 2-3: Architecture diagrams
- [ ] Day 3-4: Migration guide
- [ ] Day 4-5: Code review and cleanup
- [ ] **Checkpoint**: Documentation complete

---

## 6. RISK MITIGATION

### Backward Compatibility
- Keep old service exports during migration
- Gradual migration component by component
- Feature flags for new architecture

### Testing Strategy
- Write tests before refactoring (TDD where possible)
- Integration tests to catch breaking changes
- Manual testing checklist for each phase

### Rollback Plan
- Git branches for each phase
- Tag stable points
- Ability to revert to previous phase

---

## 7. BENEFITS SUMMARY

### Testability
- ✅ All dependencies injectable
- ✅ Can mock any service
- ✅ Unit testable in isolation
- ✅ Integration tests possible

### Maintainability
- ✅ Single Responsibility Principle
- ✅ Clear module boundaries
- ✅ Easy to locate code
- ✅ Changes isolated to modules

### Scalability
- ✅ Easy to add new features
- ✅ Easy to swap implementations
- ✅ Clear extension points
- ✅ No god classes

### Debugging
- ✅ Clear error messages
- ✅ Stack traces point to source
- ✅ Logging at boundaries
- ✅ Easy to trace data flow

---

## 8. NEXT STEPS

1. **Review this plan** with team
2. **Prioritize phases** based on business needs
3. **Set up development environment** for new structure
4. **Begin Phase 1** (Configuration & Errors)
5. **Create feature branch** for refactoring
6. **Set up CI/CD** for new structure

---

**This refactoring transforms the codebase from a tightly-coupled, hard-to-test application into a production-grade, maintainable, scalable system following industry best practices.**
