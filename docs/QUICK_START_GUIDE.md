# Quick Start Guide - New Architecture

## 🚀 Getting Started

The new Clean Architecture is ready to use! Here's how to integrate it into your app.

## Step 1: Bootstrap the Application

Update `index.tsx` to include the AppProvider:

```typescript
// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './src/presentation/providers';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
```

## Step 2: Use New Hooks in Components

### Example: Dashboard Component

```typescript
// components/Dashboard.tsx
import { useRefreshTelemetry } from '../src/presentation/hooks';
import { useJobs } from '../src/presentation/hooks';

const Dashboard = ({ stats }) => {
  const { refresh, isRefreshing } = useRefreshTelemetry();
  const { jobs } = useJobs();
  
  // Use refresh() instead of stateService.refreshTelemetry()
  // Jobs are automatically tracked
};
```

### Example: ComputersTable Component

```typescript
// components/ComputersTable.tsx
import { useBulkSync } from '../src/presentation/hooks';

const ComputersTable = ({ computers }) => {
  const { sync, isSyncing } = useBulkSync();
  
  const handleBulkAction = async (action: 'SYNC') => {
    if (action === 'SYNC') {
      await sync(Array.from(selectedIds));
    }
  };
};
```

### Example: Terminal Commands

```typescript
// In App.tsx or terminal component
import { useTerminalCommand } from '../src/presentation/hooks';

const Terminal = () => {
  const { execute, isProcessing } = useTerminalCommand();
  
  const handleCommand = async (cmd: string) => {
    const result = await execute(cmd);
    if (result) {
      // Display result
    }
  };
};
```

## Step 3: Gradual Migration

You can migrate components one at a time:

1. **Keep existing code working** - StateService still works
2. **Migrate one component** - Use new hooks
3. **Test thoroughly** - Ensure everything works
4. **Move to next component** - Repeat

## Available Hooks

### `useRefreshTelemetry()`
- Refreshes environment statistics
- Returns: `{ refresh, isRefreshing, error }`

### `useBulkSync()`
- Syncs multiple computers
- Returns: `{ sync, isSyncing, error }`

### `useMaintenance()`
- Performs cleanup and reindexing
- Returns: `{ performCleanup, reindexDatabase, isCleaning, isReindexing, error }`

### `useJobs()`
- Tracks background jobs
- Returns: `{ jobs, getJob }`

### `useTerminalCommand()`
- Executes terminal commands
- Returns: `{ execute, isProcessing, error }`

### `useScheduledTasks()`
- Manages scheduled tasks
- Returns: `{ tasks, isLoading, error, addTask, refresh }`

## Migration Bridge

The `StateServiceBridge` allows gradual migration:

```typescript
import { stateServiceBridge } from './src/bridge';

// Can use bridge which delegates to new architecture or falls back
await stateServiceBridge.refreshTelemetry();
await stateServiceBridge.performBulkAction(ids, 'SYNC');
```

## Testing

### Unit Test Example

```typescript
import { RefreshTelemetryUseCase } from './src/application/use-cases/stats/RefreshTelemetryUseCase';

describe('RefreshTelemetryUseCase', () => {
  it('should refresh telemetry', async () => {
    const mockStatsRepo = createMock<IStatsRepository>();
    const mockComputerRepo = createMock<IComputerRepository>();
    // ... other mocks
    
    const useCase = new RefreshTelemetryUseCase(
      mockStatsRepo,
      mockComputerRepo,
      // ... other dependencies
    );
    
    await useCase.execute();
    
    expect(mockStatsRepo.save).toHaveBeenCalled();
  });
});
```

## Architecture Layers

- **Domain**: Business logic (no dependencies)
- **Application**: Use cases, commands, jobs
- **Infrastructure**: External services, persistence
- **Presentation**: React components, hooks

## Benefits

✅ **Testable**: Mock any dependency
✅ **Maintainable**: Clear separation
✅ **Scalable**: Easy to extend
✅ **Type-safe**: Full TypeScript
✅ **Production-ready**: Industry best practices

## Need Help?

- See `ARCHITECTURE_IMPLEMENTATION_GUIDE.md` for detailed examples
- See `REFACTORING_EXAMPLES.md` for before/after comparisons
- Check `REFACTORING_FINAL_SUMMARY.md` for complete overview

---

**The architecture is ready. Start using it today!** 🎉
