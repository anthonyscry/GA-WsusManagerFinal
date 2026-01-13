# Architecture Overview

## 🏗️ Clean Architecture Implementation

This codebase follows **Clean Architecture** principles with clear layer separation and dependency inversion.

## 📐 Architecture Layers

### 1. Domain Layer (`src/domain/`)
**Purpose**: Core business logic - no external dependencies

- **Entities**: Rich domain models with business logic
- **Value Objects**: Immutable value objects with validation
- **Repository Interfaces**: Data access contracts
- **Domain Services**: Pure business logic
- **Errors**: Structured error hierarchy

**Key Principle**: Domain layer has ZERO dependencies on other layers

### 2. Application Layer (`src/application/`)
**Purpose**: Orchestrates business workflows

- **Use Cases**: Business operation orchestration
- **Commands**: Command pattern for terminal
- **Jobs**: Background job management
- **Events**: Event-driven communication

**Key Principle**: Depends only on Domain layer

### 3. Infrastructure Layer (`src/infrastructure/`)
**Purpose**: External concerns and implementations

- **Repositories**: Data persistence implementations
- **External Services**: WSUS, SQL, PowerShell adapters
- **Storage**: Storage abstraction
- **Logging**: Logging abstraction
- **Configuration**: Centralized configuration

**Key Principle**: Implements Domain interfaces

### 4. Presentation Layer (`src/presentation/`)
**Purpose**: UI and user interaction

- **Components**: React components (existing)
- **Hooks**: Custom React hooks for use cases
- **Context**: DI container provider
- **Providers**: App bootstrap

**Key Principle**: Depends on Application layer

## 🔄 Dependency Flow

```
Presentation → Application → Domain ← Infrastructure
     ↓              ↓           ↑            ↑
  (uses)       (orchestrates)  (implements)
```

**Rule**: Dependencies point inward toward Domain

## 🎯 Key Components

### Use Cases
Business operations encapsulated in use cases:
- `RefreshTelemetryUseCase` - Refresh environment stats
- `BulkSyncComputersUseCase` - Sync multiple computers
- `PerformCleanupUseCase` - WSUS cleanup
- `ReindexDatabaseUseCase` - Database reindexing
- `ProcessTerminalCommandUseCase` - Terminal commands
- `AddScheduledTaskUseCase` - Create scheduled tasks
- `GetScheduledTasksUseCase` - Retrieve tasks

### Repositories
Data access abstraction:
- `IComputerRepository` - Computer data access
- `IStatsRepository` - Statistics data access
- `ITaskRepository` - Task data access

### Adapters
External service wrappers:
- `WsusClientAdapter` - WSUS service wrapper
- `SqlClientAdapter` - SQL service wrapper
- `PowerShellExecutorAdapter` - PowerShell wrapper

## 🚀 Getting Started

See `QUICK_START_GUIDE.md` for integration instructions.

## 📚 Documentation

- `ARCHITECTURE_REFACTORING_PLAN.md` - Complete refactoring plan
- `REFACTORING_EXAMPLES.md` - Code examples
- `ARCHITECTURE_IMPLEMENTATION_GUIDE.md` - Detailed guide
- `QUICK_START_GUIDE.md` - Quick integration
- `COMPLETE_REFACTORING_REPORT.md` - Full report

## ✅ Benefits

- **Testable**: All dependencies injectable
- **Maintainable**: Clear separation of concerns
- **Scalable**: Easy to extend
- **Type-Safe**: Full TypeScript coverage
- **Production-Ready**: Enterprise-grade architecture

---

*Architecture follows Clean Architecture principles and SOLID design patterns.*
