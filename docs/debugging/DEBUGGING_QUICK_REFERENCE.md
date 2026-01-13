# Debugging Quick Reference
## GA-WsusManager Pro - One-Page Cheat Sheet

---

## 🔍 COMMON ISSUES → FILES TO CHECK

| Symptom | Likely File | Function/Line |
|---------|-------------|---------------|
| Data not loading | `services/stateService.ts` | `refreshTelemetry()` ~192 |
| Null reference | `services/stateService.ts` | `refreshTelemetry()` ~197-211 |
| Jobs stuck | `services/stateService.ts` | `startJob()` ~137 |
| localStorage errors | `services/stateService.ts` | `notify()` ~133 |
| PowerShell failures | `services/powershellService.ts` | `execute()` ~44 |
| SQL errors | `services/sqlService.ts` | `executeQuery()` ~20 |
| State not updating | Any service method | Missing `notify()` call |
| Performance issues | `components/*.tsx` | Unnecessary re-renders |

---

## 🚨 SEVERITY LEVELS

| Code | Severity | Response Time | Examples |
|------|----------|---------------|----------|
| P1 | CRITICAL | Immediate | Crash, data loss, security breach |
| P2 | HIGH | Same day | Major feature broken |
| P3 | MEDIUM | This sprint | Minor feature broken |
| P4 | LOW | Backlog | Cosmetic, edge cases |

---

## 🔧 QUICK DIAGNOSTICS

```bash
# Build check
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Code review
npm run review

# Check WSUS service (PowerShell)
Get-Service -Name WsusService | Select-Object Status

# Check SQL Server (PowerShell)
Get-Service -Name MSSQL* | Select-Object Status, Name
```

---

## 🐛 DEBUGGING WORKFLOW

1. **Reproduce** → Follow exact steps
2. **Isolate** → Binary search, test components separately
3. **Analyze** → Use 5 Whys technique
4. **Fix** → Address root cause, not symptoms
5. **Verify** → Test fix + regression testing

---

## 💻 BROWSER DEVTOOLS

- **Console** (Ctrl+Shift+I): Errors, logs
- **Network**: Failed requests, timeouts
- **Application** → Local Storage: Check data
- **Memory**: Heap snapshots for leaks
- **Performance**: Profile slow operations
- **React DevTools**: Component state/props

---

## 📝 LOGGING PATTERNS

```typescript
// BAD
console.log('Error');

// GOOD
loggingService.error('Failed to refresh telemetry', error, {
  context: 'StateService.refreshTelemetry',
  statsReceived: !!stats
});
```

---

## ✅ NULL SAFETY

```typescript
// Unsafe
const name = stats.db.instanceName;

// Safe - Option 1 (optional chaining)
const name = stats?.db?.instanceName ?? 'Not Connected';

// Safe - Option 2 (explicit check)
if (!stats || !stats.db) return;
const name = stats.db.instanceName;
```

---

## 🔄 ASYNC ERROR HANDLING

```typescript
// BAD (swallows error)
try {
  await operation();
} catch (error) {
  // Nothing
}

// GOOD
try {
  await operation();
} catch (error: unknown) {
  loggingService.error('Operation failed', error, {
    operation: 'operationName',
    context: additionalContext
  });
  // Handle or re-throw
}
```

---

## ⚡ PERFORMANCE DEBUGGING

```typescript
// Measure execution time
console.time('operation');
await operation();
console.timeEnd('operation');

// Or use utility
import { measureAsyncExecution } from './utils/debugHelpers';
const { result, duration } = await measureAsyncExecution(
  () => operation(),
  'Operation'
);
```

---

## 🔒 SECURITY SANITIZATION

```typescript
import { sanitizeError } from './utils/debugHelpers';

// Sanitize before logging
const safeMessage = sanitizeError(error);
loggingService.error('Error occurred', { message: safeMessage });
```

---

## 🎯 COMMON PATTERNS

### Race Condition Fix
```typescript
private refreshInProgress = false;

async refreshTelemetry() {
  if (this.refreshInProgress) return;
  this.refreshInProgress = true;
  try {
    // ... operation
  } finally {
    this.refreshInProgress = false;
  }
}
```

### Timeout Handling
```typescript
import { executeWithTimeout } from './utils/debugHelpers';

const result = await executeWithTimeout(
  wsusService.getStats(),
  30000,
  'getStats timeout'
);
```

### Retry with Backoff
```typescript
import { retryWithBackoff } from './utils/debugHelpers';

const result = await retryWithBackoff(
  () => wsusService.getStats(),
  { maxRetries: 3, initialDelayMs: 1000 }
);
```

---

## 📋 VERIFICATION CHECKLIST

- [ ] Original steps pass
- [ ] Edge cases tested
- [ ] No new errors/warnings
- [ ] Performance not degraded
- [ ] Related features still work
- [ ] Code review completed
- [ ] Documentation updated

---

## 🔗 RELATED DOCS

- **Full Runbook**: `DEBUGGING_RUNBOOK.md`
- **Session Template**: `scripts/debuggingSessionTemplate.md`
- **Code Review**: `CODE_REVIEW_REPORT.md`
- **Architecture**: `ARCHITECTURE_REFACTORING_PLAN.md`

---

## 📞 ESCALATION

**Senior Developer** → Architecture changes, security issues  
**Tech Lead** → Systemic problems, refactoring conflicts  
**Product** → Business decisions, critical production issues

---

**Last Updated**: [Auto-update on save]  
**Version**: 1.0
