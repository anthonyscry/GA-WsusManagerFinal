# Debugging Runbook
## GA-WsusManager Pro - TypeScript/React/Electron Application

This runbook provides a systematic approach to debugging and resolving issues in the WSUS Manager application. Use this document to track, diagnose, and fix bugs efficiently.

---

## 1. ISSUE INTAKE & CLASSIFICATION

### Issue Documentation Template

```markdown
ISSUE ID: [TICKET-XXX]
REPORTED BY: [Tester/User Name]
DATE FOUND: [YYYY-MM-DD]
ENVIRONMENT: [Dev/Test/Staging/Prod]
SEVERITY: [Critical/High/Medium/Low]
PRIORITY: [P1/P2/P3/P4]
STATUS: [New/Investigating/Root Cause Found/Fix In Progress/Fixed/Verified]

SUMMARY:
[One-line description of the issue]

STEPS TO REPRODUCE:
1. [Exact step]
2. [Exact step]
3. [Exact step]

EXPECTED BEHAVIOR:
[What should happen]

ACTUAL BEHAVIOR:
[What actually happens]

ERROR MESSAGES:
[Exact error text, stack traces, error codes]
```
Console logs:
```
[Paste console output]
```

Browser DevTools Errors:
```
[Paste errors]
```

Electron Main Process Logs:
```
[Paste main.js logs]
```

SCREENSHOTS/LOGS:
[Attach evidence - screenshots, log files, etc.]

FREQUENCY:
[Always/Intermittent/Random/Specific conditions]

AFFECTED COMPONENTS:
[Modules, functions, files involved]
- `services/stateService.ts`
- `components/Dashboard.tsx`
- etc.

REGRESSION:
[Did this work before? When did it break?]

WORKAROUND:
[If any exists]
```

### Severity Classification Matrix

| Severity | Priority | Criteria | Response Time |
|----------|----------|----------|---------------|
| **CRITICAL** | P1 | System crash, data loss, security breach, complete feature unusable, no workaround | Immediate, all hands |
| **HIGH** | P2 | Major feature broken, significant user impact, workaround exists but painful | Same day |
| **MEDIUM** | P3 | Minor feature broken, limited user impact, easy workaround exists | This sprint |
| **LOW** | P4 | Cosmetic issues, edge cases, minor inconvenience | Backlog |

---

## 2. SYSTEMATIC DEBUGGING METHODOLOGY

### Phase 1: Reproduction

**GOAL:** Reliably reproduce the issue in a controlled environment

**Steps:**

1. **Set up identical environment**
   - Same OS version (Windows 10/11)
   - Same Node.js version (`node --version`)
   - Same Electron version (check `package.json`)
   - Same dependencies (`npm list --depth=0`)
   - Same configuration/state

2. **Follow EXACT reproduction steps**
   - No shortcuts
   - Document any deviations
   - Try multiple times to check for intermittency

3. **Verify reproduction**
   - ✅ **Can reproduce**: Proceed to isolation
   - ❌ **Cannot reproduce**:
     - Environment difference?
     - Missing steps?
     - Timing/race condition?
     - Data-dependent?
     - Request more details from tester

4. **Document reproduction rate**
   - 100%: Deterministic - easier to debug
   - <100%: Intermittent - likely race condition, timing, or data-dependent

**Project-Specific Environment Checklist:**
```bash
# Verify environment
node --version          # Should match package.json engines
npm list electron      # Check Electron version
npm list react         # Check React version

# Check WSUS service status
Get-Service -Name WsusService, MSSQL* | Select-Object Name, Status

# Check application state
# Open DevTools (Ctrl+Shift+I) and check:
# - Console for errors
# - Application > Local Storage
# - Network tab for failed requests
```

### Phase 2: Isolation

**GOAL:** Narrow down to smallest reproducible case

**Techniques:**

#### Binary Search
1. Comment out half the code
2. Does issue persist?
   - Yes → Bug in remaining half
   - No → Bug in commented half
3. Repeat until isolated

**For this codebase - Common isolation points:**
- **Frontend vs Backend**: Check if issue occurs with mock data
- **Service Layer**: Test services independently
- **State Management**: Check if issue persists with empty state
- **Electron Main vs Renderer**: Check main.js logs vs renderer console

#### Input Minimization
- Start with failing input
- Remove elements one by one
- Find minimal input that triggers bug

#### Component Isolation
Test each module independently:
```typescript
// services/stateService.ts
// Mock dependencies
const mockWsusService = { getStats: () => Promise.resolve({...}) };
const mockSqlService = { getDatabaseMetrics: () => Promise.resolve({...}) };
```

#### Timeline Isolation
```bash
# Git bisect to find breaking commit
git bisect start
git bisect bad  # Current broken commit
git bisect good <working-commit-hash>
# Test, then:
git bisect good  # or git bisect bad
# Repeat until found
git bisect reset
```

### Phase 3: Root Cause Analysis

**GOAL:** Understand WHY the bug exists, not just WHERE

#### 5 Whys Technique

**Example:**
- **Problem**: Application crashes when refreshing telemetry
- **Why 1**: Null pointer exception in `refreshTelemetry()`
- **Why 2**: `wsusService.getStats()` returns null
- **Why 3**: WSUS service not initialized properly
- **Why 4**: `initializeServices()` failed silently
- **Why 5**: Error handling swallowed the exception
- **ROOT CAUSE**: Missing error propagation in async initialization

#### Fault Tree Analysis

```
[Application Fails to Load Data]
|
+------------------+------------------+
|                  |                  |
[StateService]     [WsusService]      [SqlService]
|                  |                  |
+------+------+    +------+------+    +------+
|      |      |    |      |      |    |      |
[Init] [Data] [UI] [Init] [PS]   [DB] [Query]
|
FIX HERE
```

#### Timeline Reconstruction

For this codebase, common sequences:

1. **Initialization Flow:**
   ```
   Constructor → initializeServices() → wsusService.initialize()
   → refreshTelemetry() → getStats() → [ERROR POINT]
   ```

2. **User Action Flow:**
   ```
   User clicks button → Event handler → Service call
   → Async operation → State update → UI re-render → [ERROR POINT]
   ```

### Phase 4: Fix Development

**GOAL:** Implement correct, complete, non-regressing fix

#### Fix Requirements Checklist
- [ ] Addresses root cause (not just symptom)
- [ ] Handles all edge cases discovered
- [ ] Includes input validation if applicable
- [ ] Has appropriate error handling
- [ ] Maintains backward compatibility
- [ ] Follows existing code patterns
- [ ] Is minimal and focused (no scope creep)
- [ ] Is documented with comments explaining why

#### Fix Anti-Patterns to Avoid
- ❌ Try/catch that swallows errors silently
- ❌ Null checks without understanding why null occurs
- ❌ Hardcoded values for specific failing case
- ❌ Disabling validation
- ❌ "It works on my machine" without understanding why
- ❌ Copy-paste code to avoid refactoring
- ❌ Quick hacks with TODO comments

### Phase 5: Verification

**GOAL:** Prove the fix works and doesn't break anything else

#### Verification Checklist
- [ ] Original reproduction steps now pass
- [ ] All related test cases pass
- [ ] Edge cases identified during debugging are covered
- [ ] No new warnings or errors introduced
- [ ] Performance not degraded
- [ ] Memory usage not increased (check DevTools Memory profiler)
- [ ] Existing functionality still works

#### Regression Testing
- [ ] Related features still work
- [ ] Service layer unaffected
- [ ] State management unchanged
- [ ] UI components render correctly
- [ ] Similar code patterns checked for same bug

---

## 3. ISSUE-SPECIFIC DEBUGGING STRATEGIES

### Logic Errors

**Symptoms:**
- Wrong output for given input
- Incorrect calculations
- Unexpected behavior path

**Common in this codebase:**
- Statistics calculations (`recalculateStats()`)
- Health status determination
- Progress percentage calculations

**Debugging approach:**
```typescript
// Add detailed logging at decision points
console.log('Debug: calculateStats', {
  totalComputers: this.computers.length,
  healthyCount: this.computers.filter(c => c.status === HealthStatus.HEALTHY).length,
  // ... other values
});

// Trace actual vs. expected values
const expected = 42;
const actual = this.calculateValue();
if (actual !== expected) {
  console.error('Mismatch:', { expected, actual, inputs: {...} });
}
```

**Common causes in this codebase:**
- Off-by-one errors in array filtering
- Incorrect boolean logic (AND vs OR)
- Wrong comparison operator (< vs <=)
- Integer division truncation
- Floating point precision in percentage calculations

### Null/Undefined Reference Errors

**Symptoms:**
- `TypeError: Cannot read property 'X' of null`
- `TypeError: Cannot read property 'X' of undefined`

**Common locations in this codebase:**
- `stateService.ts:197-211` - Missing null checks after await
- `services/*.ts` - Service responses may be null
- `components/*.tsx` - Props or state may be undefined

**Debugging approach:**
```typescript
// Identify exact line of null reference
// Check browser DevTools console for stack trace

// Trace back to source of null value
const stats = await wsusService.getStats();
console.log('Stats received:', stats);  // Is it null?
if (!stats) {
  console.error('Why is stats null?');
  console.error('wsusService initialized?', wsusService.initialized);
}

// Add defensive checks
if (!stats) {
  loggingService.warn('getStats returned null, using fallback');
  return this.getEmptyStats();
}
```

**Fix strategies:**
```typescript
// Option 1: Null coalescing
const name = stats?.db?.instanceName ?? 'Not Connected';

// Option 2: Explicit checks
if (!stats || !stats.db) {
  throw new Error('Invalid stats structure');
}

// Option 3: Default values
const stats = await wsusService.getStats() || this.getEmptyStats();
```

### Race Conditions & Timing Issues

**Symptoms:**
- Intermittent failures
- Works in debugger, fails in production
- Fails under load
- "Heisenbug" - disappears when observed

**Common in this codebase:**
- `startJob()` - Multiple jobs running concurrently
- `refreshTelemetry()` - Called while previous call still running
- `performBulkAction()` - Async operations in loop

**Debugging approach:**
```typescript
// Add timestamps to all operations
const startTime = Date.now();
await this.refreshTelemetry();
const duration = Date.now() - startTime;
console.log(`refreshTelemetry took ${duration}ms`);

// Identify shared resources
// - this.stats (shared state)
// - this.computers (shared state)
// - localStorage (shared storage)

// Map concurrent access patterns
console.log('Concurrent jobs:', this.jobs.length);
console.log('Active refreshTelemetry calls:', this.refreshInProgress);
```

**Fix strategies:**
```typescript
// Add proper async/await patterns
private refreshInProgress = false;

async refreshTelemetry() {
  if (this.refreshInProgress) {
    loggingService.warn('Refresh already in progress, skipping');
    return;
  }
  
  this.refreshInProgress = true;
  try {
    // ... refresh logic
  } finally {
    this.refreshInProgress = false;
  }
}

// Use Promise.all for parallel operations (when safe)
const [stats, computers] = await Promise.all([
  wsusService.getStats(),
  wsusService.getComputers()
]);
```

### Memory Issues

**Symptoms:**
- Gradual performance degradation
- Memory usage grows over time
- UI becomes sluggish

**Common causes in this codebase:**
- Event listeners not cleaned up
- `subscribe()` listeners accumulating
- localStorage growing unbounded
- Job timers not cleared

**Debugging approach:**
```javascript
// Chrome DevTools > Memory > Take Heap Snapshot
// Compare snapshots over time

// Check for listener leaks
console.log('Active listeners:', stateService.listeners.size);

// Check localStorage size
let totalSize = 0;
for (let key in localStorage) {
  totalSize += localStorage[key].length + key.length;
}
console.log('LocalStorage size:', totalSize, 'bytes');
```

**Fix strategies:**
```typescript
// Clean up subscriptions
useEffect(() => {
  const unsubscribe = stateService.subscribe(() => {
    // ... update state
  });
  return unsubscribe;  // Cleanup on unmount
}, []);

// Clear old jobs
private cleanupCompletedJobs() {
  const oneHourAgo = Date.now() - 3600000;
  this.jobs = this.jobs.filter(job => 
    job.status === 'Running' || job.startTime > oneHourAgo
  );
}

// Limit localStorage usage
private pruneLocalStorage() {
  const keys = Object.keys(localStorage);
  if (keys.length > 50) {
    // Remove oldest entries
  }
}
```

### Performance Issues

**Symptoms:**
- Slow response times
- Timeout errors
- UI freezing
- High CPU usage

**Common bottlenecks in this codebase:**
- `refreshTelemetry()` - Multiple async service calls
- `getComputers()` - Large dataset processing
- Component re-renders - Unnecessary updates
- localStorage operations - Synchronous I/O

**Debugging approach:**
```typescript
// Profile to find hotspots
console.time('refreshTelemetry');
await this.refreshTelemetry();
console.timeEnd('refreshTelemetry');

// Measure database query time
const queryStart = Date.now();
const results = await sqlService.executeQuery(query);
console.log(`Query took ${Date.now() - queryStart}ms`);

// React DevTools Profiler
// - Record interaction
// - Identify expensive renders
// - Check for unnecessary re-renders
```

**Fix strategies:**
```typescript
// Batch database queries
const queries = ['query1', 'query2', 'query3'];
const results = await Promise.all(
  queries.map(q => sqlService.executeQuery(q))
);

// Debounce rapid calls
private refreshTimeout: NodeJS.Timeout | null = null;
refreshTelemetry() {
  if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
  this.refreshTimeout = setTimeout(() => {
    this.doRefreshTelemetry();
  }, 500);
}

// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

### UI/GUI Issues

**Symptoms:**
- Elements not displaying
- Incorrect layout
- Events not firing
- State not updating

**Common in this codebase:**
- React state not updating
- Component not re-rendering
- Event handlers not attached
- CSS styling issues

**Debugging approach:**
```typescript
// Check React DevTools
// - Components tab: Check component state/props
// - Profiler: Record and analyze renders

// Add lifecycle logging
useEffect(() => {
  console.log('Component mounted/updated');
  return () => console.log('Component unmounted');
}, [dependencies]);

// Verify event handlers
const handleClick = () => {
  console.log('Button clicked');  // Does this log?
  // ... handler logic
};

// Check data flow
console.log('Props received:', props);
console.log('State:', state);
```

**Fix strategies:**
```typescript
// Ensure proper state updates
const [count, setCount] = useState(0);
setCount(prev => prev + 1);  // Use functional update if needed

// Check dependencies in useEffect
useEffect(() => {
  // Effect logic
}, [dependency1, dependency2]);  // Include all dependencies

// Use key prop for forced re-render
<Component key={uniqueId} data={data} />
```

### Integration/API Issues

**Symptoms:**
- PowerShell execution failures
- SQL query errors
- WSUS service connection failures
- Timeout errors

**Common in this codebase:**
- `powershellService.execute()` failures
- `sqlService.executeQuery()` errors
- `wsusService.initialize()` connection issues

**Debugging approach:**
```typescript
// Capture actual request/response
const result = await powershellService.execute(command);
console.log('PowerShell result:', {
  success: result.success,
  exitCode: result.exitCode,
  stdout: result.stdout.substring(0, 200),  // First 200 chars
  stderr: result.stderr
});

// Test PowerShell command directly
// Open PowerShell and run:
// powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "YOUR_COMMAND"

// Check WSUS service status
Get-Service -Name WsusService | Select-Object Status, StartType
Get-WsusServer | Select-Object Name, Port
```

**Fix strategies:**
```typescript
// Add timeout handling
async executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
}

// Implement retry with backoff
async executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Validate response before parsing
if (!result.success || !result.stdout) {
  throw new Error(`Command failed: ${result.stderr}`);
}
```

### Security Issues

**Symptoms:**
- Vulnerability scan findings
- SQL injection risks
- Command injection risks
- Sensitive data exposure

**Common in this codebase:**
- SQL query string concatenation
- PowerShell command injection
- Error messages exposing system details
- Passwords in logs

**Debugging approach:**
```typescript
// Reproduce the exact attack vector
const maliciousInput = "'; DROP TABLE Computers; --";
// Test if it's properly escaped

// Trace data flow from input to vulnerability
console.log('User input:', userInput);
console.log('Sanitized input:', sanitizedInput);
console.log('Final query:', query);
```

**Fix strategies:**
```typescript
// Parameterized queries (when using proper SQL library)
// For PowerShell SQL, escape properly:
function escapeSqlString(input: string): string {
  return input.replace(/'/g, "''").replace(/;/g, '');
}

// Escape PowerShell commands
function escapePowerShellCommand(input: string): string {
  return input.replace(/"/g, '\\"').replace(/\$/g, '`$');
}

// Sanitize error messages
private sanitizeError(error: any): string {
  const message = error?.message || 'An error occurred';
  return message
    .replace(/C:\\[^\s]+/g, '[PATH]')
    .replace(/at\s+.*\n/g, '')
    .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
    .substring(0, 200);
}
```

---

## 4. DEBUGGING TOOLS & TECHNIQUES

### Debugging Utilities

**Location**: `utils/debugHelpers.ts`

This codebase includes comprehensive debugging utilities. Import and use these helpers for common debugging tasks:

```typescript
import {
  sanitizeError,
  measureAsyncExecution,
  retryWithBackoff,
  executeWithTimeout,
  safeJsonParse,
  SafeLocalStorage,
  createDebugLogger,
  createDiagnosticReport
} from './utils/debugHelpers';
```

**Key Utilities**:
- **Error Handling**: `sanitizeError()`, `getErrorMessage()`, `isError()`
- **Performance**: `measureAsyncExecution()`, `measureSyncExecution()`
- **Async Operations**: `retryWithBackoff()`, `executeWithTimeout()`
- **Data Safety**: `safeJsonParse()`, `SafeLocalStorage`, `isNullish()`, `assertNotNull()`
- **Logging**: `createDebugLogger()` - Create structured logger for modules
- **Diagnostics**: `createDiagnosticReport()` - Generate application state report

**Usage Examples**:
```typescript
// Sanitize errors before logging
const safeError = sanitizeError(error);
loggingService.error('Operation failed', { error: safeError });

// Measure performance
const { result, duration } = await measureAsyncExecution(
  () => wsusService.getStats(),
  'getStats'
);

// Retry with backoff
const data = await retryWithBackoff(
  () => fetchData(),
  { maxRetries: 3, initialDelayMs: 1000 }
);

// Execute with timeout
const result = await executeWithTimeout(
  wsusService.getStats(),
  30000,
  'getStats timeout'
);
```

**See**: `utils/debugHelpers.ts` for complete API documentation.

### Automation Scripts

**Debug Checklist Script**: `scripts/debugChecklist.js`

Run automated checks before starting debugging:
```bash
npm run debug:checklist
```

This script checks:
- Environment (Node.js, npm versions)
- Build status (TypeScript, ESLint)
- Common issues (console.log, debugger, empty catch blocks)
- Key files existence
- Documentation status

**See**: `DEBUGGING_INDEX.md` for complete tool documentation.

### Logging Strategy

**Log Levels:**
- **ERROR**: Exceptions, failures (always on)
- **WARN**: Unexpected but handled conditions
- **INFO**: Key business events
- **DEBUG**: Detailed execution flow (dev only)
- **TRACE**: Very detailed, verbose (perf impact)

**Effective Log Messages:**
```typescript
// BAD
loggingService.error('Error occurred');

// GOOD
loggingService.error(`Failed to save computer [id=${computerId}, name=${computerName}]: ${error.message}`, {
  context: 'ComputerService.saveComputer',
  errorCode: error.code,
  userId: currentUser?.id
});
```

**Strategic Log Points in this codebase:**
```typescript
// Function entry/exit
async refreshTelemetry() {
  loggingService.debug('refreshTelemetry:start', { useRealServices: this.useRealServices });
  try {
    // ... logic
    loggingService.debug('refreshTelemetry:success');
  } catch (error) {
    loggingService.error('refreshTelemetry:failure', { error: error.message });
    throw;
  }
}

// Before/after external calls
loggingService.debug('Calling wsusService.getStats()');
const stats = await wsusService.getStats();
loggingService.debug('wsusService.getStats() completed', { statsReceived: !!stats });

// Decision branch points
if (this.useRealServices) {
  loggingService.debug('Using real WSUS services');
} else {
  loggingService.debug('Using mock/offline mode');
}

// State changes
this.stats = newStats;
loggingService.info('Stats updated', {
  totalComputers: newStats.totalComputers,
  healthyCount: newStats.healthyComputers
});
```

### Breakpoint Strategies

**Browser DevTools (Chrome/Edge):**
- **Conditional Breakpoints**: Right-click line number > Add conditional breakpoint
  - Example: `userId === "problem_user"`
- **Logpoints**: Log without stopping (right-click > Add logpoint)
  - Example: `User ID: ${userId}, Status: ${status}`
- **Exception Breakpoints**: Break on all exceptions (Sources > Breakpoints > ⚙️)

**VS Code Debugger:**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Electron Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "args": ["."],
      "outputCapture": "std"
    },
    {
      "name": "Debug Electron Renderer",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}",
      "timeout": 30000
    }
  ]
}
```

### Diagnostic Commands

**PowerShell Debugging:**
```powershell
# Check WSUS service
Get-Service -Name WsusService, MSSQL* | Format-Table Name, Status, StartType

# Check WSUS server
Get-WsusServer | Select-Object Name, Port, UseSSL

# Test PowerShell execution
$command = "Get-Process | Select-Object -First 5"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command $command

# Check SQL Server
Get-Service -Name MSSQL* | Select-Object Name, Status
sqlcmd -S localhost\SQLEXPRESS -Q "SELECT @@VERSION"

# Monitor application logs
Get-Content "path\to\app.log" -Wait -Tail 50
```

**Node.js/Electron Debugging:**
```bash
# Run with debugging enabled
npm run electron -- --inspect=9222

# Check for memory leaks
node --expose-gc --trace-gc app.js

# Profile CPU usage
node --prof app.js
node --prof-process isolate-*.log > processed.txt
```

**Browser DevTools:**
- **Console**: `console.log()`, `console.error()`, `console.table()`
- **Network**: Monitor API calls, check request/response
- **Memory**: Take heap snapshots, check for leaks
- **Performance**: Record performance profile
- **Application**: Check localStorage, sessionStorage, IndexedDB

---

## 5. FIX DOCUMENTATION

### Fix Documentation Template

```markdown
ISSUE ID: [TICKET-XXX]
FIX DATE: [YYYY-MM-DD]
FIXED BY: [Developer Name]
ROOT CAUSE:
[Detailed explanation of why the bug occurred]

AFFECTED FILES:
- services/stateService.ts (lines 197-211)
- components/Dashboard.tsx (lines 45-60)

CHANGES MADE:
1. Added null check after wsusService.getStats() call
   - Prevents null reference when WSUS service unavailable
   - Provides fallback to empty stats structure
   
2. Added error handling in refreshTelemetry()
   - Catches and logs errors properly
   - Maintains previous state on failure
   
3. Added validation for job duration parameter
   - Prevents DoS via extremely long durations
   - Limits max duration to 10 minutes

CODE DIFF:
```diff
 async refreshTelemetry() {
   loggingService.info('Polling infrastructure for fresh telemetry...');
   
   if (this.useRealServices) {
     try {
       const stats = await wsusService.getStats();
       const computers = await wsusService.getComputers();
       
+      if (!stats) {
+        loggingService.warn('getStats returned null, using empty stats');
+        return;
+      }
+      
       // Get database metrics
       const dbMetrics = await sqlService.getDatabaseMetrics();
       if (dbMetrics) {
         stats.db = dbMetrics;
       }
       this.stats = stats;
     } catch (error: any) {
       loggingService.error(`Error refreshing telemetry: ${error.message}`);
+      // Don't update data if there's an error - keep current state
+      return;
     }
   }
   
   this.notify();
 }
```

TESTING PERFORMED:
- [x] Reproduction steps verified fixed
- [x] Unit tests added/updated
- [x] Integration tests pass
- [x] Manual testing completed
- [x] Edge cases verified (null responses, errors, timeouts)

REGRESSION RISK:
Low - Changes are defensive and don't modify existing behavior, only add safety checks

RELATED ISSUES:
- TICKET-YYY: Similar null reference in getComputers()
- TICKET-ZZZ: Missing error handling in performCleanup()

DEPLOYMENT NOTES:
- No breaking changes
- No configuration changes required
- Backward compatible

MONITORING:
- Watch for "getStats returned null" warnings in logs
- Monitor error rates after deployment
- Check if refreshTelemetry() failures increase
```

### Code Change Documentation

**For each fix, include inline comments:**
```typescript
// FIX: TICKET-123 - Prevent null reference when WSUS service unavailable
// ROOT CAUSE: getStats() returns null when WSUS service not initialized,
// but caller assumed non-null return
// FIXED: Added explicit null check with appropriate handling
if (!stats) {
  loggingService.warn('WSUS service unavailable, stats not retrieved');
  // Don't update stats - keep previous state
  return;
}
// Previous code (for reference during review):
// this.stats = stats;  // This could assign null, causing issues
```

---

## 6. DEBUGGING SESSION TEMPLATE

### For Each Issue, Complete:

```
═══════════════════════════════════════════════════════════════
DEBUGGING SESSION: [ISSUE-ID]
═══════════════════════════════════════════════════════════════

ISSUE SUMMARY:
[One line description]

REPRODUCTION RESULT:
☐ Reproduced successfully
☐ Could not reproduce - need more info
☐ Intermittent - reproduced X/Y attempts (X%)

ISOLATION FINDINGS:
Component: [Where bug lives]
  - File: services/stateService.ts
  - Function: refreshTelemetry()
  - Line(s): 197-211
  - Trigger: WSUS service returns null

ROOT CAUSE:
[Detailed explanation]
The refreshTelemetry() method calls wsusService.getStats() which can
return null when the WSUS service is not properly initialized. The code
assumes a non-null return value and directly assigns it to this.stats,
causing null reference errors when stats properties are accessed later.

FIX IMPLEMENTED:
[Description of changes]
1. Added null check after getStats() call
2. Added early return if stats is null
3. Added warning log for visibility
4. Maintains previous state on failure

FILES MODIFIED:
- services/stateService.ts (lines 200-204)

VERIFICATION:
☐ Original steps pass
☐ Unit tests pass
☐ Integration tests pass
☐ Edge cases verified
☐ No regressions found

SIMILAR CODE CHECKED:
- Searched for similar patterns: "await.*getStats()" - found 2 instances
- Checked getComputers() - already has null check ✓
- Checked performCleanup() - needs similar fix (logged as TICKET-YYY)

READY FOR:
☐ Code review
☐ QA verification
☐ Deployment

═══════════════════════════════════════════════════════════════
```

---

## 7. COMMON FIX PATTERNS FOR THIS CODEBASE

### Defensive Coding Additions

**Parameter Validation:**
```typescript
// BEFORE (vulnerable)
startJob(name: string, durationMs: number = 3000, onComplete?: () => void) {
  // ... uses durationMs directly
}

// AFTER (defensive)
startJob(name: string, durationMs: number = 3000, onComplete?: () => void) {
  // Validate duration
  if (durationMs < 0 || durationMs > 600000) {
    throw new Error(`Invalid job duration: ${durationMs}ms. Must be between 0 and 600000ms`);
  }
  
  // Limit concurrent jobs
  if (this.jobs.length >= 10) {
    throw new Error('Maximum number of concurrent jobs (10) reached');
  }
  
  // ... rest of implementation
}
```

### Error Handling Improvements

**Before (swallowed error):**
```typescript
try {
  const stats = await wsusService.getStats();
  this.stats = stats;
} catch (error: any) {
  // Do nothing - error swallowed
}
```

**After (proper handling):**
```typescript
try {
  const stats = await wsusService.getStats();
  if (!stats) {
    loggingService.warn('getStats returned null - WSUS service may not be initialized');
    return; // Don't update state
  }
  this.stats = stats;
  this.notify();
} catch (error: any) {
  loggingService.error(`Failed to refresh telemetry: ${error.message}`, {
    errorType: error.constructor.name,
    stack: error.stack?.substring(0, 500)
  });
  // Don't update state on error - keep previous state
  // User can see last known good state
} finally {
  this.refreshInProgress = false;
}
```

### Race Condition Fixes

**Before (race condition):**
```typescript
async refreshTelemetry() {
  const stats = await wsusService.getStats();  // Could be called multiple times
  this.stats = stats;
  this.notify();
}
```

**After (atomic operation with proper locking):**
```typescript
private refreshInProgress = false;

async refreshTelemetry() {
  if (this.refreshInProgress) {
    loggingService.debug('Refresh already in progress, skipping duplicate call');
    return;
  }
  
  this.refreshInProgress = true;
  try {
    const stats = await wsusService.getStats();
    if (stats) {
      this.stats = stats;
      this.notify();
    }
  } catch (error: any) {
    loggingService.error(`Error refreshing telemetry: ${error.message}`);
  } finally {
    this.refreshInProgress = false;
  }
}
```

### Null Safety Patterns

**Before (null unsafe):**
```typescript
const instanceName = stats.db.instanceName;
```

**After (null safe):**
```typescript
// Option 1: Optional chaining with nullish coalescing
const instanceName = stats?.db?.instanceName ?? 'Not Connected';

// Option 2: Explicit checks
const instanceName = (stats && stats.db && stats.db.instanceName) 
  ? stats.db.instanceName 
  : 'Not Connected';

// Option 3: Guard clause
if (!stats || !stats.db) {
  loggingService.warn('Invalid stats structure');
  return;
}
const instanceName = stats.db.instanceName;
```

### localStorage Error Handling

**Before (no error handling):**
```typescript
private notify() {
  localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
  localStorage.setItem(STORAGE_KEY_COMPUTERS, JSON.stringify(this.computers));
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(this.tasks));
}
```

**After (defensive with quota handling):**
```typescript
private notify() {
  this.listeners.forEach(l => l());
  
  try {
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
    localStorage.setItem(STORAGE_KEY_COMPUTERS, JSON.stringify(this.computers));
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(this.tasks));
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      loggingService.warn('LocalStorage quota exceeded, clearing old data');
      this.clearOldLocalStorage();
      try {
        // Retry with cleared storage
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
      } catch (retryError) {
        loggingService.error('Failed to persist state after clearing storage');
      }
    } else {
      loggingService.error('Failed to persist state to localStorage', error);
    }
  }
}

private clearOldLocalStorage() {
  // Remove oldest entries or non-essential data
  const keysToKeep = [STORAGE_KEY_STATS, STORAGE_KEY_COMPUTERS, STORAGE_KEY_TASKS];
  Object.keys(localStorage).forEach(key => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  });
}
```

---

## 8. PROJECT-SPECIFIC DEBUGGING CHECKLIST

### Initial Debugging Setup
- [ ] Open browser DevTools (Ctrl+Shift+I)
- [ ] Check Console tab for errors
- [ ] Check Network tab for failed requests
- [ ] Check Application > Local Storage for data
- [ ] Enable React DevTools extension
- [ ] Check Electron main process logs (if available)

### Common Issues Quick Reference

| Symptom | Likely Cause | File to Check |
|---------|--------------|---------------|
| Data not loading | WSUS service not initialized | `services/stateService.ts:71-92` |
| Null reference errors | Missing null checks | `services/stateService.ts:197-211` |
| Jobs not completing | Timer/interval issues | `services/stateService.ts:137-177` |
| Performance issues | Too many re-renders | Components using `useState` |
| localStorage errors | Quota exceeded | `services/stateService.ts:94-99` |
| PowerShell failures | Execution errors | `services/powershellService.ts:44-98` |
| SQL query failures | Connection/query issues | `services/sqlService.ts:20-58` |
| State not updating | Missing notify() call | All service methods |

### Quick Diagnostic Commands

```bash
# Check if app builds
npm run build

# Check for TypeScript errors
npm run typecheck

# Check for linting errors
npm run lint

# Run code review script
npm run review

# Start app in dev mode
npm run dev

# Start Electron app
npm run electron
```

---

## 9. ESCALATION PROCEDURES

### When to Escalate

**Escalate to Senior Developer when:**
- Root cause identified but fix requires architecture changes
- Issue affects multiple systems/components
- Fix requires security review
- Performance issue requires profiling expertise
- Data loss or corruption suspected

**Escalate to Tech Lead/Architect when:**
- Issue reveals fundamental architecture problems
- Multiple related issues point to systemic problems
- Fix conflicts with planned refactoring
- Security vulnerability confirmed

**Escalate to Product/Management when:**
- Critical production issue with no workaround
- Issue requires business decision (feature change, etc.)
- Timeline impact on releases
- Customer-facing critical bug

### Contact Information

```
Senior Developers: [Add names/contacts]
Tech Lead: [Add name/contact]
On-Call Rotation: [Add rotation schedule]
```

---

## 10. LESSONS LEARNED & PREVENTION

### Common Root Causes Summary

1. **Missing null checks** - Always validate async responses
2. **Race conditions** - Add locks/flags for async operations
3. **Error swallowing** - Always log and handle errors properly
4. **Missing validation** - Validate all user inputs and parameters
5. **State synchronization** - Ensure notify() called after state changes

### Prevention Recommendations

1. **Add unit tests** for common error paths
2. **Add integration tests** for service interactions
3. **Code review checklist** - Include null checks, error handling
4. **TypeScript strict mode** - Enable stricter type checking
5. **ESLint rules** - Add rules for common pitfalls
6. **Documentation** - Document expected nullability of return values

---

## APPENDIX: QUICK REFERENCE

### Key Files & Their Responsibilities

- `services/stateService.ts` - Main state management, job orchestration
- `services/wsusService.ts` - WSUS API interactions
- `services/sqlService.ts` - SQL Server queries
- `services/powershellService.ts` - PowerShell execution
- `services/loggingService.ts` - Logging service
- `components/Dashboard.tsx` - Main dashboard UI
- `components/ComputersTable.tsx` - Computer list table
- `main.js` - Electron main process

### Common Patterns

- **Singleton services**: All services are singletons (for now)
- **Observer pattern**: `stateService.subscribe()` for state updates
- **Async/await**: All service methods are async
- **Error handling**: Try-catch with logging
- **State persistence**: localStorage for state

### Useful Links

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [WSUS PowerShell Module](https://docs.microsoft.com/powershell/module/updateservices/)

---

**Document Version:** 1.0  
**Last Updated:** [Date]  
**Maintained By:** Development Team
