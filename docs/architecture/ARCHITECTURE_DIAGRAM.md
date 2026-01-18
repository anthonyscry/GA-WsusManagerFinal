# Architecture Diagram - GA-WsusManager Pro

## Clean Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  (React Components + Hooks)                                  │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                 │
│  • Dashboard                                                 │
│  • ComputersTable                                            │
│  • MaintenanceView                                           │
│  • AutomationView                                            │
│  • AuditView                                                 │
│                                                              │
│  Hooks:                                                      │
│  • useStats()                                                │
│  • useComputers()                                            │
│  • useJobs()                                                 │
│  • useRefreshTelemetry()                                     │
│  • useBulkSync()                                             │
│  • useMaintenance()                                          │
│  • useScheduledTasks()                                       │
│  • useTerminalCommand()                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   APPLICATION LAYER                           │
│  (Use Cases + Commands + Jobs)                               │
├─────────────────────────────────────────────────────────────┤
│  Use Cases:                                                   │
│  • RefreshTelemetryUseCase                                   │
│  • BulkSyncComputersUseCase                                  │
│  • PerformCleanupUseCase                                     │
│  • ReindexDatabaseUseCase                                    │
│  • ProcessTerminalCommandUseCase                            │
│  • AddScheduledTaskUseCase                                   │
│  • GetScheduledTasksUseCase                                  │
│                                                              │
│  Commands:                                                    │
│  • StatusCommand                                             │
│  • PingCommand                                               │
│  • HelpCommand                                               │
│  • ClearCommand                                              │
│  • ReindexCommand                                            │
│  • CleanupCommand                                            │
│                                                              │
│  Jobs:                                                        │
│  • JobManager                                                │
│  • EventBus                                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      DOMAIN LAYER                             │
│  (Entities + Value Objects + Services)                       │
├─────────────────────────────────────────────────────────────┤
│  Entities:                                                    │
│  • Computer                                                   │
│  • EnvironmentStats                                           │
│  • ScheduledTask                                              │
│                                                              │
│  Value Objects:                                              │
│  • HealthStatus                                               │
│  • DatabaseMetrics                                            │
│                                                              │
│  Domain Services:                                            │
│  • StatsCalculator                                            │
│  • HealthAnalyzer                                             │
│                                                              │
│  Repository Interfaces:                                      │
│  • IStatsRepository                                           │
│  • IComputerRepository                                        │
│  • ITaskRepository                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                          │
│  (Adapters + Implementations)                                 │
├─────────────────────────────────────────────────────────────┤
│  Repositories:                                                │
│  • StatsRepository (uses LocalStorageAdapter)                │
│  • ComputerRepository (uses LocalStorageAdapter)              │
│  • TaskRepository (uses LocalStorageAdapter)                  │
│                                                              │
│  External Services:                                          │
│  • WsusClientAdapter (wraps wsusService)                     │
│  • SqlClientAdapter (wraps sqlService)                        │
│  • PowerShellExecutorAdapter (wraps powershellService)       │
│                                                              │
│  State Modules:                                              │
│  • JobManager, TerminalHandler, StigChecker, StorageManager  │
│                                                              │
│  Storage:                                                     │
│  • LocalStorageAdapter (browser localStorage)                 │
│                                                              │
│  Logging:                                                     │
│  • LoggingServiceAdapter (wraps loggingService)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    EXTERNAL WORLD                             │
│  (System APIs + Optional Services)                           │
├─────────────────────────────────────────────────────────────┤
│  • Electron APIs (main.js)                                    │
│  • PowerShell (Windows built-in)                              │
│  • localStorage (browser API)                                │
│  • WSUS Server (optional)                                    │
│  • SQL Server (optional)                                     │
└──────────────────────────────────────────────────────────────┘
```

## State Service Architecture

```
StateService (Facade)
  ├── JobManager       - Background job lifecycle
  ├── TerminalHandler  - Terminal command processing
  ├── StigChecker      - STIG compliance checks
  ├── StorageManager   - localStorage persistence
  ├── types.ts         - Shared types and constants
  └── utils.ts         - Utility functions
```

## Data Flow

### Reading Data
```
Component → Hook → Use Case → Repository → Storage (localStorage)
                                    ↓
                              Domain Entity
```

### Writing Data
```
Component → Hook → Use Case → Repository → Storage (localStorage)
                                    ↓
                              Domain Entity
                                    ↓
                              Event Bus → Components Update
```

### External Operations
```
Component → Hook → Use Case → External Adapter → System Service
                                    ↓
                              (WSUS/SQL/PowerShell)
```

## Dependency Injection Flow

```
AppProvider (bootstrap)
    ↓
createContainer()
    ↓
Registers all services
    ↓
ServiceProvider (React Context)
    ↓
Components use hooks
    ↓
Hooks use useService()
    ↓
Resolves from Container
```

## Standalone Portable App Architecture

### Core (Always Available)
- ✅ Electron runtime (bundled)
- ✅ React UI (bundled)
- ✅ localStorage (browser API)
- ✅ PowerShell (Windows built-in)

### Optional (Works Without)
- ⚠️ WSUS Server (falls back to mock data)
- ⚠️ SQL Server (operations disabled if unavailable)
- ⚠️ Network connectivity (air-gap mode)

### Data Persistence
- ✅ localStorage (session data)
- ✅ No external database required
- ✅ No cloud services required
- ✅ Fully offline capable

## Component Interaction

```
App.tsx
  ├─ AppProvider (DI Container)
  │   └─ ServiceProvider
  │       └─ App Component
  │           ├─ Dashboard (uses stats from useStats)
  │           ├─ ComputersTable (uses useBulkSync)
  │           ├─ MaintenanceView (uses useMaintenance)
  │           ├─ AutomationView (uses useScheduledTasks)
  │           └─ Other views...

StateService (Facade)
  ├─ JobManager ◄─── Callback (State Notify)
  ├─ TerminalHandler ◄─ Callbacks (Stats, Reindex, Cleanup)
  ├─ StigChecker ◄─── Uses PowerShellService
  └─ StorageManager ◄─ Debounced Persistence
```

## Event-Driven Updates

```
Use Case executes
    ↓
Publishes event (EventBus.publish)
    ↓
Hooks subscribe (EventBus.subscribe)
    ↓
Components re-render automatically
```

## Standalone Guarantees

1. **No Runtime Dependencies**: Everything bundled in Electron
2. **No Network Required**: Works completely offline
3. **No Database Server**: Uses localStorage
4. **No Installation**: Portable EXE runs anywhere
5. **Self-Contained**: All code in single executable
