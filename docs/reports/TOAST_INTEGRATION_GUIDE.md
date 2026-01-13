# Toast Notification Integration Guide

## Overview

The toast notification system is ready to use. This guide shows how to integrate it with your components and the logging service.

## Basic Usage

### 1. Import the Hook

```tsx
import { useToast } from '../hooks/useToast';
```

### 2. Use in Component

```tsx
const MyComponent: React.FC = () => {
  const { success, error, warning, info } = useToast();

  const handleAction = async () => {
    try {
      // Perform action
      await someOperation();
      success('Operation completed successfully!');
    } catch (err) {
      error('Operation failed. Please try again.');
    }
  };

  return (
    <button onClick={handleAction}>
      Perform Action
    </button>
  );
};
```

## Integration with Logging Service

### Option 1: Direct Integration (Recommended)

Update `services/loggingService.ts` to accept an optional toast callback:

```typescript
// In loggingService.ts
class LoggingService {
  private toastCallback?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;

  setToastCallback(callback: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void) {
    this.toastCallback = callback;
  }

  private log(level: LogLevel, message: string, context?: unknown) {
    // ... existing log code ...
    
    // Show toast for important messages
    if (this.toastCallback) {
      if (level === LogLevel.ERROR) {
        this.toastCallback(message, 'error');
      } else if (level === LogLevel.WARNING) {
        this.toastCallback(message, 'warning');
      } else if (message.includes('[SUCCESS]')) {
        this.toastCallback(message, 'success');
      }
    }
  }
}
```

Then in `App.tsx`:

```tsx
const { success, error, warning, info } = useToast();

useEffect(() => {
  loggingService.setToastCallback((message, type) => {
    if (type === 'error') error(message);
    else if (type === 'warning') warning(message);
    else if (type === 'success') success(message);
    else info(message);
  });
}, [success, error, warning, info]);
```

### Option 2: Event Listener (Alternative)

Listen to log events and show toasts:

```tsx
useEffect(() => {
  const handleLog = (event: CustomEvent<LogEntry>) => {
    const entry = event.detail;
    if (entry.level === 'ERROR') {
      error(entry.message);
    } else if (entry.level === 'WARNING') {
      warning(entry.message);
    } else if (entry.message.includes('[SUCCESS]')) {
      success(entry.message);
    }
  };

  window.addEventListener('wsus_log_added', handleLog as EventListener);
  return () => window.removeEventListener('wsus_log_added', handleLog as EventListener);
}, [success, error, warning]);
```

## Toast Types

- **success**: Green, checkmark icon - For successful operations
- **error**: Red, X icon - For errors (stays 7 seconds)
- **warning**: Yellow, warning icon - For warnings
- **info**: Blue, info icon - For informational messages

## Custom Duration

```tsx
// Show error for 10 seconds instead of default 7
error('Critical error occurred', 10000);

// Show success for 3 seconds instead of default 5
success('Saved!', 3000);
```

## Best Practices

1. **Don't show toasts for every log** - Only important user-facing messages
2. **Keep messages concise** - Toast messages should be short and actionable
3. **Use appropriate types** - Match toast type to message severity
4. **Don't spam** - Limit toast frequency to avoid overwhelming users

## Examples

### Success Toast
```tsx
success('Database reindexing completed successfully');
```

### Error Toast
```tsx
error('Failed to connect to SQL Server. Please check your credentials.');
```

### Warning Toast
```tsx
warning('This operation may take several minutes to complete');
```

### Info Toast
```tsx
info('Processing your request...');
```
