# API Documentation - GA-WsusManager Pro

## Overview

This document describes the API surface of the GA-WsusManager Pro application, organized by architectural layer.

---

## 🎣 Presentation Layer Hooks

### `useStats()`

**Location**: `src/presentation/hooks/useStats.ts`

**Description**: Hook for accessing environment statistics with automatic updates.

**Returns**:
```typescript
{
  stats: EnvironmentStats;
  isLoading: boolean;
}
```

**Usage**:
```typescript
const { stats, isLoading } = useStats();
```

**Features**:
- Automatically subscribes to stats updates via event bus
- Loads initial stats on mount
- Handles loading states

---

### `useComputers()`

**Location**: `src/presentation/hooks/useComputers.ts`

**Description**: Hook for accessing computer inventory with automatic updates.

**Returns**:
```typescript
{
  computers: WsusComputer[];
  isLoading: boolean;
}
```

**Usage**:
```typescript
const { computers, isLoading } = useComputers();
```

**Features**:
- Automatically subscribes to computer updates
- Converts domain entities to component interfaces
- Handles loading states

---

### `useJobs()`

**Location**: `src/presentation/hooks/useJobs.ts`

**Description**: Hook for accessing background jobs.

**Returns**:
```typescript
{
  jobs: Job[];
  getJob: (jobId: string) => Job | undefined;
}
```

**Usage**:
```typescript
const { jobs, getJob } = useJobs();
```

---

### `useRefreshTelemetry()`

**Location**: `src/presentation/hooks/useRefreshTelemetry.ts`

**Description**: Hook for refreshing telemetry data.

**Returns**:
```typescript
{
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  error: Error | null;
}
```

**Usage**:
```typescript
const { refresh, isRefreshing } = useRefreshTelemetry();

await refresh();
```

---

### `useBulkSync()`

**Location**: `src/presentation/hooks/useBulkSync.ts`

**Description**: Hook for bulk syncing computers.

**Returns**:
```typescript
{
  sync: (computerIds: string[]) => Promise<void>;
  isSyncing: boolean;
  error: Error | null;
}
```

**Usage**:
```typescript
const { sync, isSyncing } = useBulkSync();

await sync(['id1', 'id2']);
```

---

### `useMaintenance()`

**Location**: `src/presentation/hooks/useMaintenance.ts`

**Description**: Hook for maintenance operations.

**Returns**:
```typescript
{
  reindexDatabase: (saPassword?: string) => Promise<void>;
  performCleanup: () => Promise<void>;
  isReindexing: boolean;
  isCleaning: boolean;
  error: Error | null;
}
```

**Usage**:
```typescript
const { reindexDatabase, performCleanup, isReindexing } = useMaintenance();

await reindexDatabase(password);
await performCleanup();
```

---

### `useScheduledTasks()`

**Location**: `src/presentation/hooks/useScheduledTasks.ts`

**Description**: Hook for managing scheduled tasks.

**Returns**:
```typescript
{
  tasks: ScheduledTask[];
  isLoading: boolean;
  error: Error | null;
  addTask: (input: { name: string; trigger: 'Daily' | 'Weekly' | 'Monthly'; time: string }) => Promise<ScheduledTask>;
  refresh: () => Promise<void>;
}
```

**Usage**:
```typescript
const { tasks, addTask } = useScheduledTasks();

await addTask({ name: 'Task1', trigger: 'Daily', time: '03:00' });
```

---

### `useTerminalCommand()`

**Location**: `src/presentation/hooks/useTerminalCommand.ts`

**Description**: Hook for processing terminal commands.

**Returns**:
```typescript
{
  execute: (command: string) => Promise<string | null>;
  isProcessing: boolean;
  error: Error | null;
}
```

**Usage**:
```typescript
const { execute, isProcessing } = useTerminalCommand();

const result = await execute('help');
```

---

## 🎯 Application Layer Use Cases

### `RefreshTelemetryUseCase`

**Location**: `src/application/use-cases/stats/RefreshTelemetryUseCase.ts`

**Description**: Orchestrates telemetry refresh from WSUS and SQL Server.

**Method**:
```typescript
async execute(): Promise<void>
```

**Dependencies**:
- StatsRepository
- ComputerRepository
- WsusClient
- SqlClient
- Logger
- EventBus

**Events Published**:
- `stats.updated`
- `computers.updated`

---

### `BulkSyncComputersUseCase`

**Location**: `src/application/use-cases/computers/BulkSyncComputersUseCase.ts`

**Description**: Performs bulk synchronization of computers.

**Method**:
```typescript
async execute(computerIds: string[]): Promise<void>
```

**Dependencies**:
- ComputerRepository
- WsusClient
- JobManager
- Logger

---

### `PerformCleanupUseCase`

**Location**: `src/application/use-cases/maintenance/PerformCleanupUseCase.ts`

**Description**: Performs database cleanup operation.

**Method**:
```typescript
async execute(): Promise<void>
```

**Dependencies**:
- StatsRepository
- WsusClient
- SqlClient
- JobManager
- Logger

---

### `ReindexDatabaseUseCase`

**Location**: `src/application/use-cases/maintenance/ReindexDatabaseUseCase.ts`

**Description**: Reindexes the SUSDB database.

**Method**:
```typescript
async execute(saPassword?: string): Promise<void>
```

**Dependencies**:
- SqlClient
- JobManager
- Logger

---

## 🏗️ Domain Layer

### Entities

#### `Computer`

**Location**: `src/domain/entities/Computer.ts`

**Properties**:
- `id: string`
- `name: string`
- `ipAddress: string`
- `os: string`
- `status: HealthStatus`
- `lastSync: Date`
- `updatesNeeded: number`
- `updatesInstalled: number`
- `targetGroup: string`

**Methods**:
- `get compliancePercentage(): number`
- `isHealthy(): boolean`
- `needsAttention(): boolean`
- `markSynced(): void`
- `updateSyncStatus(): void`
- `applyUpdates(count: number): void`
- `markUpdatesNeeded(count: number): void`
- `toJSON(): Record<string, unknown>`
- `static fromJSON(data): Computer`

---

#### `EnvironmentStats`

**Location**: `src/domain/entities/EnvironmentStats.ts`

**Properties**:
- `totalComputers: number`
- `healthyComputers: number`
- `warningComputers: number`
- `criticalComputers: number`
- `totalUpdates: number`
- `securityUpdatesCount: number`
- `services: ServiceState[]`
- `db: DatabaseMetrics`
- `isInstalled: boolean`
- `diskFreeGB: number`
- `automationStatus: 'Ready' | 'Not Set' | 'Running'`

**Methods**:
- `get compliancePercentage(): number`
- `isHealthy(): boolean`
- `needsAttention(): boolean`
- `getComputersByStatus(status: HealthStatus): number`
- `recalculateFromComputers(...): void`
- `toJSON(): Record<string, unknown>`
- `static empty(): EnvironmentStats`

---

### Value Objects

#### `HealthStatus`

**Location**: `src/domain/value-objects/HealthStatus.ts`

**Values**:
- `HEALTHY`
- `WARNING`
- `CRITICAL`
- `UNKNOWN`

**Functions**:
- `getHealthStatusFromLastSync(lastSync: Date): HealthStatus`

---

#### `DatabaseMetrics`

**Location**: `src/domain/value-objects/DatabaseMetrics.ts`

**Properties**:
- `readonly currentSizeGB: number`
- `readonly maxSizeGB: number`
- `readonly instanceName: string`
- `readonly contentPath: string`
- `readonly lastBackup: string`

**Functions**:
- `createDatabaseMetrics(...): DatabaseMetrics`
- `calculateDatabaseUsagePercentage(metrics: DatabaseMetrics): number`
- `isDatabaseUsageWarning(metrics: DatabaseMetrics, threshold?: number): boolean`

---

### Domain Services

#### `StatsCalculator`

**Location**: `src/domain/services/StatsCalculator.ts`

**Static Methods**:
- `calculateHealthDistribution(computers: Computer[]): HealthDistribution`
- `calculateAverageCompliance(computers: Computer[]): number`

---

#### `HealthAnalyzer`

**Location**: `src/domain/services/HealthAnalyzer.ts`

**Methods**:
- `analyzeEnvironment(stats: EnvironmentStats): HealthAnalysis`
- `analyzeComputer(computer: Computer): HealthAnalysis`

---

## 🔌 Infrastructure Layer

### Repositories

#### `IStatsRepository`

**Location**: `src/domain/repositories/IStatsRepository.ts`

**Methods**:
- `get(): Promise<EnvironmentStats>`
- `save(stats: EnvironmentStats): Promise<void>`
- `clear(): Promise<void>`

---

#### `IComputerRepository`

**Location**: `src/domain/repositories/IComputerRepository.ts`

**Methods**:
- `findAll(): Promise<Computer[]>`
- `findById(id: string): Promise<Computer | null>`
- `findByStatus(status: HealthStatus): Promise<Computer[]>`
- `findByTargetGroup(targetGroup: string): Promise<Computer[]>`
- `save(computer: Computer): Promise<void>`
- `saveAll(computers: Computer[]): Promise<void>`
- `delete(id: string): Promise<void>`
- `count(): Promise<number>`
- `countByStatus(status: HealthStatus): Promise<number>`

---

### External Services

#### `IWsusClient`

**Location**: `src/infrastructure/external/wsus/IWsusClient.ts`

**Methods**:
- `initialize(server?: string, port?: number, useSsl?: boolean): Promise<boolean>`
- `getStats(): Promise<EnvironmentStats | null>`
- `getComputers(): Promise<Computer[]>`
- `forceComputerSync(computerName: string): Promise<boolean>`
- `performCleanup(): Promise<boolean>`

---

#### `ISqlClient`

**Location**: `src/infrastructure/external/sql/ISqlClient.ts`

**Methods**:
- `getDatabaseMetrics(): Promise<DatabaseMetrics | null>`
- `reindexDatabase(saPassword?: string): Promise<boolean>`

---

### Storage

#### `IStorage`

**Location**: `src/infrastructure/persistence/storage/IStorage.ts`

**Methods**:
- `get<T>(key: string): Promise<T | null>`
- `set<T>(key: string, value: T): Promise<void>`
- `remove(key: string): Promise<void>`
- `clear(): Promise<void>`
- `has(key: string): Promise<boolean>`

**Implementation**: `LocalStorageAdapter` (uses browser localStorage)

---

### Logging

#### `ILogger`

**Location**: `src/infrastructure/logging/ILogger.ts`

**Methods**:
- `info(message: string, context?: Record<string, unknown>): void`
- `warn(message: string, context?: Record<string, unknown>): void`
- `error(message: string, context?: Record<string, unknown>): void`
- `debug?(message: string, context?: Record<string, unknown>): void`

---

### Events

#### `IEventBus`

**Location**: `src/application/events/IEventBus.ts`

**Methods**:
- `subscribe(event: string, listener: () => void): () => void`
- `publish(event: string): void`

**Events**:
- `stats.updated`
- `computers.updated`
- `jobs.updated`

---

## 🔧 Dependency Injection

### Container

**Location**: `src/di/Container.ts`

**Methods**:
- `register<T>(token: string, factory: () => T): void`
- `registerSingleton<T>(token: string, instance: T): void`
- `resolve<T>(token: string): T`
- `has(token: string): boolean`
- `clear(): void`

### Bootstrap

**Location**: `src/di/bootstrap.ts`

**Function**:
```typescript
createContainer(): Container
```

**Registers**:
- Storage (LocalStorageAdapter)
- Logger (LoggingServiceAdapter)
- EventBus
- PowerShellExecutor
- WsusClient
- SqlClient
- Repositories (Computer, Stats, Task)
- JobManager
- Use Cases
- Command Handler

---

## 📦 Standalone Portable App Features

### No External Dependencies Required

- ✅ Uses Electron (bundled)
- ✅ Uses localStorage (browser API)
- ✅ Uses PowerShell (Windows built-in)
- ✅ Works offline (air-gap mode)
- ✅ No internet required for core functionality
- ✅ No database server required (uses localStorage)

### Optional External Services

- WSUS Server (optional - app works without it)
- SQL Server (optional - for database operations)
- Docker (optional - for testing environment)

---

## 🔒 Security Considerations

### Standalone App Security

- ✅ No external API calls (except optional WSUS/SQL)
- ✅ Credentials stored in localStorage (session-only)
- ✅ Input validation on all commands
- ✅ Command whitelist enforced
- ✅ SQL injection protection (query validation)

---

## 📚 Additional Resources

- **Migration Guide**: `docs/refactoring/MIGRATION_GUIDE.md`
- **Architecture Overview**: `docs/architecture/README_ARCHITECTURE.md`
- **Refactoring Progress**: `docs/refactoring/REFACTORING_PROGRESS.md`
