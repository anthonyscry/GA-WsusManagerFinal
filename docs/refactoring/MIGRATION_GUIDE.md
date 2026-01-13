# Migration Guide: StateService to New Architecture

This guide helps you migrate from the deprecated `StateService` to the new Clean Architecture hooks and use cases.

## Overview

The new architecture provides:
- ✅ Better separation of concerns
- ✅ Improved testability
- ✅ Type-safe hooks
- ✅ Event-driven updates
- ✅ Dependency injection

## Quick Reference

| Old (StateService) | New (Hook) | Location |
|-------------------|------------|----------|
| `stateService.getStats()` | `useStats()` | `src/presentation/hooks/useStats.ts` |
| `stateService.getComputers()` | `useComputers()` | `src/presentation/hooks/useComputers.ts` |
| `stateService.getJobs()` | `useJobs()` | `src/presentation/hooks/useJobs.ts` |
| `stateService.refreshTelemetry()` | `useRefreshTelemetry()` | `src/presentation/hooks/useRefreshTelemetry.ts` |
| `stateService.performBulkAction(ids, 'SYNC')` | `useBulkSync()` | `src/presentation/hooks/useBulkSync.ts` |
| `stateService.reindexDatabase()` | `useMaintenance()` | `src/presentation/hooks/useMaintenance.ts` |
| `stateService.performCleanup()` | `useMaintenance()` | `src/presentation/hooks/useMaintenance.ts` |
| `stateService.getTasks()` | `useScheduledTasks()` | `src/presentation/hooks/useScheduledTasks.ts` |
| `stateService.addTask()` | `useScheduledTasks()` | `src/presentation/hooks/useScheduledTasks.ts` |
| `stateService.processTerminalCommand()` | `useTerminalCommand()` | `src/presentation/hooks/useTerminalCommand.ts` |

## Migration Steps

### 1. Wrap Your App with AppProvider

**Before:**
```tsx
import App from './App';

root.render(<App />);
```

**After:**
```tsx
import App from './App';
import { AppProvider } from './src/presentation/providers/AppProvider';

root.render(
  <AppProvider>
    <App />
  </AppProvider>
);
```

### 2. Replace StateService.getStats()

**Before:**
```tsx
import { stateService } from './services/stateService';

const MyComponent = () => {
  const [stats, setStats] = useState(stateService.getStats());
  
  useEffect(() => {
    const unsubscribe = stateService.subscribe(() => {
      setStats(stateService.getStats());
    });
    return unsubscribe;
  }, []);
  
  return <div>{stats.totalComputers}</div>;
};
```

**After:**
```tsx
import { useStats } from './src/presentation/hooks';

const MyComponent = () => {
  const { stats, isLoading } = useStats();
  
  return <div>{stats.totalComputers}</div>;
};
```

### 3. Replace StateService.getComputers()

**Before:**
```tsx
const [computers, setComputers] = useState(stateService.getComputers());

useEffect(() => {
  const unsubscribe = stateService.subscribe(() => {
    setComputers(stateService.getComputers());
  });
  return unsubscribe;
}, []);
```

**After:**
```tsx
import { useComputers } from './src/presentation/hooks';

const { computers, isLoading } = useComputers();
```

### 4. Replace StateService.refreshTelemetry()

**Before:**
```tsx
const handleRefresh = async () => {
  await stateService.refreshTelemetry();
};
```

**After:**
```tsx
import { useRefreshTelemetry } from './src/presentation/hooks';

const { refresh, isRefreshing } = useRefreshTelemetry();

const handleRefresh = async () => {
  await refresh();
};
```

### 5. Replace Bulk Actions

**Before:**
```tsx
await stateService.performBulkAction(ids, 'SYNC');
```

**After:**
```tsx
import { useBulkSync } from './src/presentation/hooks';

const { sync, isSyncing } = useBulkSync();

await sync(ids);
```

### 6. Replace Maintenance Operations

**Before:**
```tsx
await stateService.reindexDatabase(password);
await stateService.performCleanup();
```

**After:**
```tsx
import { useMaintenance } from './src/presentation/hooks';

const { reindexDatabase, performCleanup, isReindexing, isCleaning } = useMaintenance();

await reindexDatabase(password);
await performCleanup();
```

### 7. Replace Scheduled Tasks

**Before:**
```tsx
const [tasks, setTasks] = useState(stateService.getTasks());

useEffect(() => {
  const unsubscribe = stateService.subscribe(() => {
    setTasks(stateService.getTasks());
  });
  return unsubscribe;
}, []);

stateService.addTask({ name, trigger, time });
```

**After:**
```tsx
import { useScheduledTasks } from './src/presentation/hooks';

const { tasks, addTask, isLoading } = useScheduledTasks();

await addTask({ name, trigger, time });
```

### 8. Replace Terminal Commands

**Before:**
```tsx
stateService.processTerminalCommand(command);
```

**After:**
```tsx
import { useTerminalCommand } from './src/presentation/hooks';

const { execute, isProcessing } = useTerminalCommand();

await execute(command);
```

## Component Migration Examples

### Example 1: Dashboard Component

**Before:**
```tsx
interface DashboardProps {
  stats: EnvironmentStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  // Component code
};
```

**After:**
```tsx
import { useStats } from '../src/presentation/hooks';

const Dashboard: React.FC = () => {
  const { stats, isLoading } = useStats();
  
  if (isLoading) return <div>Loading...</div>;
  
  // Component code
};
```

### Example 2: Computers Table

**Before:**
```tsx
interface ComputersTableProps {
  computers: WsusComputer[];
}

const ComputersTable: React.FC<ComputersTableProps> = ({ computers }) => {
  const handleSync = async () => {
    await stateService.performBulkAction([id], 'SYNC');
  };
};
```

**After:**
```tsx
import { useComputers, useBulkSync } from '../src/presentation/hooks';

const ComputersTable: React.FC = () => {
  const { computers } = useComputers();
  const { sync } = useBulkSync();
  
  const handleSync = async () => {
    await sync([id]);
  };
};
```

## Benefits of Migration

1. **Automatic Updates**: Hooks subscribe to events automatically
2. **Loading States**: Built-in loading and error states
3. **Type Safety**: Full TypeScript support
4. **Testability**: Easy to mock and test
5. **Separation**: Business logic separated from UI

## What Still Uses StateService?

Some features still use StateService temporarily:
- Air gap mode management (will be migrated)
- STIG checks (static data, low priority)
- Some legacy operations (PING, RESET bulk actions)

These will be migrated in future phases.

## Troubleshooting

### Hook not working?
- Ensure your component is wrapped with `<AppProvider>`
- Check that you're importing from `src/presentation/hooks`

### Data not updating?
- Hooks use event bus - ensure events are published
- Check browser console for errors

### Type errors?
- Ensure you're using the correct types from domain entities
- Check that imports are correct

## Need Help?

- See `docs/refactoring/REFACTORING_PROGRESS.md` for architecture details
- Check `src/presentation/hooks/` for hook implementations
- Review `src/application/use-cases/` for use case logic
