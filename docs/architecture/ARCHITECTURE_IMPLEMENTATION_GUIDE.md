# Architecture Implementation Guide

## Quick Start: Using the New Architecture

### 1. Bootstrap the Application

```typescript
// In your main entry point (index.tsx or App.tsx)
import { createContainer } from './src/di/bootstrap';
import { ServiceProvider } from './src/presentation/context';

const container = createContainer();

ReactDOM.render(
  <ServiceProvider container={container}>
    <App />
  </ServiceProvider>,
  document.getElementById('root')
);
```

### 2. Use Hooks in Components

```typescript
// components/Dashboard.tsx
import { useRefreshTelemetry } from '../src/presentation/hooks';
import { useJobs } from '../src/presentation/hooks';

const Dashboard = () => {
  const { refresh, isRefreshing } = useRefreshTelemetry();
  const { jobs } = useJobs();
  
  // Use refresh() instead of stateService.refreshTelemetry()
};
```

### 3. Use Cases Directly (Advanced)

```typescript
import { useService } from '../src/presentation/context';
import { TOKENS } from '../src/di/tokens';
import { RefreshTelemetryUseCase } from '../src/application/use-cases';

const MyComponent = () => {
  const useCase = useService<RefreshTelemetryUseCase>(TOKENS.REFRESH_TELEMETRY_USE_CASE);
  
  const handleRefresh = async () => {
    try {
      await useCase.execute();
    } catch (error) {
      // Handle error
    }
  };
};
```

## Migration Strategy

### Option 1: Gradual Migration (Recommended)
- Keep existing StateService working
- New features use new architecture
- Gradually migrate components one by one

### Option 2: Parallel Implementation
- Run both systems in parallel
- Feature flag to switch between them
- Full migration when stable

### Option 3: Big Bang (Not Recommended)
- Replace everything at once
- Higher risk
- Requires extensive testing

## Testing the New Architecture

### Unit Test Example

```typescript
// __tests__/application/use-cases/RefreshTelemetryUseCase.test.ts
import { RefreshTelemetryUseCase } from '../../../src/application/use-cases';
import { createMockRepository, createMockClient } from '../../helpers';

describe('RefreshTelemetryUseCase', () => {
  it('should refresh telemetry successfully', async () => {
    const mockStatsRepo = createMockRepository();
    const mockComputerRepo = createMockRepository();
    const mockWsusClient = createMockClient();
    
    const useCase = new RefreshTelemetryUseCase(
      mockStatsRepo,
      mockComputerRepo,
      mockWsusClient,
      // ... other mocks
    );
    
    await useCase.execute();
    
    expect(mockStatsRepo.save).toHaveBeenCalled();
  });
});
```

## Architecture Layers

### Domain Layer (Business Logic)
- **Entities**: Computer, EnvironmentStats, ScheduledTask
- **Value Objects**: HealthStatus, DatabaseMetrics
- **Services**: StatsCalculator, HealthAnalyzer
- **No Dependencies**: Pure business logic

### Application Layer (Orchestration)
- **Use Cases**: Business workflows
- **Jobs**: Background task management
- **Events**: Event-driven communication
- **Depends on**: Domain + Infrastructure

### Infrastructure Layer (External Concerns)
- **Repositories**: Data persistence
- **External Services**: WSUS, SQL, PowerShell adapters
- **Storage**: LocalStorage abstraction
- **Logging**: Logging abstraction
- **Depends on**: Domain interfaces only

### Presentation Layer (UI)
- **Components**: React components
- **Hooks**: React hooks for use cases
- **Context**: DI container provider
- **Depends on**: Application layer

## Key Principles

1. **Dependency Rule**: Dependencies point inward
   - Presentation → Application → Domain
   - Infrastructure → Domain

2. **Interface Segregation**: Small, focused interfaces

3. **Dependency Inversion**: Depend on abstractions, not concretions

4. **Single Responsibility**: Each class/function does one thing

5. **Open/Closed**: Open for extension, closed for modification

## Benefits Realized

✅ **Testability**: All dependencies injectable
✅ **Maintainability**: Clear separation of concerns
✅ **Scalability**: Easy to add new features
✅ **Flexibility**: Swap implementations easily
✅ **Type Safety**: Full TypeScript support

---

**The architecture is production-ready and follows industry best practices!**
