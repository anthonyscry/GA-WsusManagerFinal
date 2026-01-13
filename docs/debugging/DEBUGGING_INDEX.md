# Debugging Documentation Index
## GA-WsusManager Pro - Complete Debugging Resource Guide

This document provides an index to all debugging-related resources, tools, and documentation in the codebase.

---

## 📚 DOCUMENTATION

### Primary Documents

1. **[DEBUGGING_RUNBOOK.md](./DEBUGGING_RUNBOOK.md)** ⭐ **START HERE**
   - Comprehensive debugging methodology
   - Systematic 5-phase approach
   - Issue-specific debugging strategies
   - Fix patterns and verification checklists
   - **Use for**: Learning the complete debugging process

2. **[DEBUGGING_QUICK_REFERENCE.md](./DEBUGGING_QUICK_REFERENCE.md)** 📋
   - One-page cheat sheet
   - Common issues → files mapping
   - Quick diagnostic commands
   - Code snippets and patterns
   - **Use for**: Quick lookup during debugging

3. **[scripts/debuggingSessionTemplate.md](./scripts/debuggingSessionTemplate.md)** 📝
   - Template for tracking debugging sessions
   - Issue documentation format
   - Root cause analysis structure
   - Verification checklist
   - **Use for**: Documenting each debugging session

### Related Documentation

- **[CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md)** - Known issues and code quality findings
- **[ARCHITECTURE_REFACTORING_PLAN.md](./ARCHITECTURE_REFACTORING_PLAN.md)** - Architecture patterns and refactoring guidance
- **[REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)** - Completed refactoring work

---

## 🛠️ TOOLS & UTILITIES

### Debugging Utilities

**Location**: `utils/debugHelpers.ts`

Provides helper functions for common debugging tasks:

- **Error Handling**
  - `isError()` - Type guard for Error instances
  - `getErrorMessage()` - Safely extract error messages
  - `getErrorStack()` - Extract stack traces
  - `sanitizeError()` - Remove sensitive data from errors

- **Performance Debugging**
  - `measureAsyncExecution()` - Measure async function execution time
  - `measureSyncExecution()` - Measure sync function execution time

- **Async Operations**
  - `retryWithBackoff()` - Retry with exponential backoff
  - `executeWithTimeout()` - Execute with timeout protection

- **Data Safety**
  - `safeJsonParse()` - Parse JSON with default fallback
  - `SafeLocalStorage` - localStorage operations with error handling
  - `isNullish()` - Null/undefined type guard
  - `assertNotNull()` - Assert non-null with error

- **Logging**
  - `createDebugLogger()` - Create structured logger for modules
  - `createErrorContext()` - Create error context objects

- **Diagnostics**
  - `createDiagnosticReport()` - Generate application state report

**Usage Example**:
```typescript
import { sanitizeError, measureAsyncExecution, retryWithBackoff } from './utils/debugHelpers';

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
```

### Automation Scripts

1. **Debug Checklist Script**
   - **Location**: `scripts/debugChecklist.js`
   - **Command**: `npm run debug:checklist`
   - **Purpose**: Automated checks before starting debugging
   - **Features**:
     - Environment validation
     - Build status check
     - Common issue detection
     - Key files verification
     - Documentation status

   **Usage**:
   ```bash
   # Run all checks
   npm run debug:checklist

   # Run specific checks
   node scripts/debugChecklist.js --env      # Environment only
   node scripts/debugChecklist.js --build    # Build status only
   node scripts/debugChecklist.js --issues   # Issue detection only
   ```

2. **Code Review Script**
   - **Location**: `scripts/codeReview.js`
   - **Command**: `npm run review`
   - **Purpose**: Automated code quality checks
   - **Runs**: Automatically after build (`postbuild`)

---

## 🔍 DEBUGGING WORKFLOW

### Step-by-Step Process

1. **Before Starting**
   ```bash
   # Run debugging checklist
   npm run debug:checklist
   
   # Check for build errors
   npm run typecheck
   npm run lint
   ```

2. **Document the Issue**
   - Copy `scripts/debuggingSessionTemplate.md`
   - Fill in issue details
   - Use format from DEBUGGING_RUNBOOK.md Section 1

3. **Reproduce**
   - Follow exact steps from tester
   - Document reproduction rate
   - Note environment details

4. **Isolate**
   - Use binary search technique
   - Test components separately
   - Check DEBUGGING_RUNBOOK.md Section 2

5. **Analyze Root Cause**
   - Use 5 Whys technique
   - Create fault tree
   - Reconstruct timeline
   - See DEBUGGING_RUNBOOK.md Section 3

6. **Implement Fix**
   - Follow fix requirements checklist
   - Avoid anti-patterns
   - Use debug helpers if needed
   - See DEBUGGING_RUNBOOK.md Section 4

7. **Verify**
   - Complete verification checklist
   - Run regression tests
   - Document results
   - See DEBUGGING_RUNBOOK.md Section 5

8. **Document Fix**
   - Update debugging session template
   - Document root cause and fix
   - Note related issues
   - See DEBUGGING_RUNBOOK.md Section 5

---

## 🎯 COMMON ISSUES QUICK REFERENCE

| Issue | File to Check | Section in Runbook |
|-------|---------------|-------------------|
| Data not loading | `services/stateService.ts:refreshTelemetry()` | Section 3: Integration/API Issues |
| Null reference | `services/stateService.ts:refreshTelemetry()` | Section 3: Null/Undefined Reference Errors |
| Jobs stuck | `services/stateService.ts:startJob()` | Section 3: Race Conditions |
| localStorage errors | `services/stateService.ts:notify()` | Section 3: Memory Issues |
| PowerShell failures | `services/powershellService.ts:execute()` | Section 3: Integration/API Issues |
| SQL errors | `services/sqlService.ts:executeQuery()` | Section 3: Integration/API Issues |
| Performance | Components with useState | Section 3: Performance Issues |
| State not updating | Missing `notify()` calls | Section 3: UI/GUI Issues |

---

## 📖 LEARNING PATH

### For New Developers

1. **Start**: Read DEBUGGING_QUICK_REFERENCE.md (15 minutes)
2. **Understand**: Read DEBUGGING_RUNBOOK.md Section 1-2 (30 minutes)
3. **Practice**: Use debuggingSessionTemplate.md for first issue
4. **Master**: Complete DEBUGGING_RUNBOOK.md (2 hours)
5. **Reference**: Keep DEBUGGING_QUICK_REFERENCE.md handy

### For Experienced Developers

1. **Quick Ref**: DEBUGGING_QUICK_REFERENCE.md for patterns
2. **Utilities**: Review `utils/debugHelpers.ts` for available tools
3. **Workflow**: Follow Step-by-Step Process above
4. **Deep Dive**: DEBUGGING_RUNBOOK.md Section 3 for specific issue types

### For Code Reviewers

1. **Checklist**: Review CODE_REVIEW_REPORT.md for known issues
2. **Patterns**: Check DEBUGGING_RUNBOOK.md Section 7 for fix patterns
3. **Verification**: Ensure verification checklist is completed
4. **Documentation**: Verify debugging session template is filled

---

## 🔗 INTEGRATION WITH EXISTING TOOLS

### VS Code Debugging

Create `.vscode/launch.json` (if not exists):
```json
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
    }
  ]
}
```

### Browser DevTools

- **Console**: Use loggingService (not console.log)
- **Network**: Monitor API calls
- **Application**: Check localStorage
- **Memory**: Profile for leaks
- **Performance**: Record interactions
- **React DevTools**: Inspect component state

### PowerShell Debugging

For WSUS/SQL debugging:
```powershell
# Check WSUS service
Get-Service -Name WsusService | Select-Object Status, StartType

# Check SQL Server
Get-Service -Name MSSQL* | Select-Object Status, Name

# Test PowerShell execution
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Process"
```

---

## 📋 CHECKLISTS

### Pre-Debugging Checklist

- [ ] Run `npm run debug:checklist`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run lint`
- [ ] Review CODE_REVIEW_REPORT.md for similar issues
- [ ] Copy debuggingSessionTemplate.md for new issue
- [ ] Open DEBUGGING_QUICK_REFERENCE.md for quick lookup

### Post-Fix Checklist

- [ ] Original reproduction steps pass
- [ ] Edge cases tested
- [ ] No new errors/warnings
- [ ] Performance not degraded
- [ ] Related features still work
- [ ] Code review completed
- [ ] Debugging session template completed
- [ ] Documentation updated if needed

---

## 🆘 GETTING HELP

### Escalation Path

1. **Self-Help**
   - Check DEBUGGING_QUICK_REFERENCE.md
   - Review DEBUGGING_RUNBOOK.md relevant section
   - Run `npm run debug:checklist`

2. **Team**
   - Review CODE_REVIEW_REPORT.md for similar issues
   - Check debugging session templates for similar cases
   - Ask team for similar experiences

3. **Escalate**
   - Senior Developer: Architecture changes, security issues
   - Tech Lead: Systemic problems, refactoring conflicts
   - Product: Business decisions, critical production issues

---

## 📝 DOCUMENTATION MAINTENANCE

### Keeping Docs Updated

- **When adding new debugging utilities**: Update this index
- **When finding new common issues**: Add to DEBUGGING_QUICK_REFERENCE.md
- **When discovering new patterns**: Add to DEBUGGING_RUNBOOK.md Section 7
- **When fixing critical bugs**: Document in debugging session template

### Version History

- **v1.0** - Initial debugging infrastructure
  - Created comprehensive runbook
  - Added quick reference guide
  - Created debugging utilities
  - Added automation scripts

---

## 🎓 BEST PRACTICES

1. **Always document**: Use debugging session template for every issue
2. **Use utilities**: Leverage `utils/debugHelpers.ts` for common tasks
3. **Follow methodology**: Use 5-phase approach from runbook
4. **Verify thoroughly**: Complete verification checklist
5. **Learn from patterns**: Review Section 7 of runbook before coding fixes
6. **Share knowledge**: Document new patterns and common issues

---

**Last Updated**: [Auto-update on changes]  
**Maintained By**: Development Team  
**Questions?**: See DEBUGGING_RUNBOOK.md or ask team
