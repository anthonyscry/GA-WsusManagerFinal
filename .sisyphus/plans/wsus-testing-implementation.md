# WSUS Operations Testing Implementation Plan

**Created:** January 18, 2026  
**Project:** GA-WsusManager Pro v3.8.9  
**Goal:** 80%+ coverage on services/wsus/*.ts, 90%+ on powershellService.ts  
**Timeline:** 2-3 days implementation  
**Tools:** Jest, Playwright, Pester, GitHub Actions (free tier)

---

## Executive Summary

This plan implements comprehensive testing for WSUS operations WITHOUT requiring actual WSUS server hardware. All testing is achieved through mocking the PowerShell execution layer.

### Testing Pyramid

- Layer 4: E2E (Playwright) - UI flows with mocked backend
- Layer 3: Integration (Jest) - Full workflows with fake PS responses  
- Layer 2: Unit Tests (Jest) - Service parsing/transformation logic
- Layer 1: PowerShell (Pester) - PS script logic in isolation (existing)

### Coverage Targets

| Component | Target | Current | Tests Needed |
|-----------|--------|---------|--------------|
| services/wsus/computers.ts | 80% | 0% | ~15 |
| services/wsus/updates.ts | 80% | 0% | ~20 |
| services/wsus/maintenance.ts | 80% | 0% | ~12 |
| services/wsus/connection.ts | 80% | 0% | ~6 |
| services/powershellService.ts | 90% | 0% | ~15 |
| **Total New Tests** | - | - | **~68** |

---

## Phase 1: Test Infrastructure Setup

### Task 1.1: Update Jest Configuration

**File: jest.config.js**

Add these modifications to existing config:

1. Add 'tests/' to roots array alongside 'src/'
2. Add test pattern for tests/**/*.test.ts
3. Add services/**/*.ts to collectCoverageFrom
4. Add coverageThreshold section:
   - services/wsus/*.ts: 80% lines/functions/statements, 75% branches
   - services/powershellService.ts: 90% lines/functions/statements, 85% branches
5. Add setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']

### Task 1.2: Create Test Setup File

**File: tests/setup.ts**

Create global test setup with:
- localStorage mock (store, getItem, setItem, removeItem, clear)
- sessionStorage mock (same structure)
- window.crypto.getRandomValues mock
- window.dispatchEvent mock
- beforeEach hook to clear all mocks and reset stores
- jest.setTimeout(30000) for integration tests

### Task 1.3: Directory Structure

Create:
- tests/setup.ts
- tests/unit/services/__mocks__/powershellService.ts
- tests/unit/services/__mocks__/loggingService.ts
- tests/unit/services/wsus/computers.test.ts
- tests/unit/services/wsus/updates.test.ts
- tests/unit/services/wsus/maintenance.test.ts
- tests/unit/services/wsus/connection.test.ts
- tests/unit/services/powershellService.test.ts
- tests/integration/wsusWorkflows.test.ts
- tests/integration/fixtures/wsusResponses.ts

---

## Phase 2: Mock Infrastructure

### Task 2.1: PowerShell Service Mock

**File: tests/unit/services/__mocks__/powershellService.ts**

Exports:
- mockExecute: jest.fn for execute()
- mockCheckModule: jest.fn for checkModule()
- mockImportModule: jest.fn for importModule()
- powershellService object with all mocks
- createSuccessResult(stdout): Creates { success: true, stdout, stderr: '', exitCode: 0 }
- createFailureResult(stderr, exitCode=1): Creates { success: false, stdout: '', stderr, exitCode }
- createJsonResult(data): Wraps JSON.stringify(data) in createSuccessResult
- resetMocks(): Clears all mock state

### Task 2.2: Logging Service Mock

**File: tests/unit/services/__mocks__/loggingService.ts**

Exports:
- mockInfo, mockWarn, mockError: jest.fn() for each log level
- loggingService object with all mocks plus getLogs, clearLogs stubs
- resetMocks(): Clears all mock state

---

## Phase 3: Unit Tests - Detailed Specifications

### Task 3.1: computers.test.ts (~15 tests)

**File: tests/unit/services/wsus/computers.test.ts**

Mock setup:
- jest.mock('../../../../services/powershellService')
- jest.mock('../../../../services/loggingService')
- Import mock helpers from __mocks__

**Test Suite: getComputers()**

1. **Successful Responses**
   - "should parse single computer response" - Verify all fields mapped correctly
   - "should parse array of multiple computers" - Test 3+ computers, verify IDs assigned sequentially
   - "should handle empty array response" - Return []

2. **Health Status Mapping** (use test.each)
   - Test cases: healthy/Healthy/HEALTHY -> HEALTHY
   - warning/Warning -> WARNING  
   - critical/Critical -> CRITICAL
   - Unknown/empty string/invalid -> UNKNOWN

3. **Missing Field Handling**
   - "should use defaults for missing fields" - Verify: name='Unknown', ipAddress='0.0.0.0', os='Unknown OS', lastSync='Never', targetGroup='Unassigned Computers'
   - "should handle null values gracefully"

4. **Error Handling**
   - "should return empty array on PowerShell failure"
   - "should return empty array on malformed JSON"
   - "should return empty array when execute throws"
   - "should return empty array on empty stdout"

**Test Suite: getStats()**

5. **Successful Responses**
   - "should combine WSUS stats with disk info" - Mock 2 calls, verify all fields
   - "should map service statuses correctly" - Running->Running, Stopped->Stopped, other->Pending

6. **Error Handling**
   - "should return null on WSUS stats failure"
   - "should handle disk query failure gracefully" - Stats returned, diskFreeGB=0
   - "should return null on malformed JSON"

7. **Default Values**
   - "should use defaults for missing numeric fields" - All zeros

### Task 3.2: updates.test.ts (~20 tests)

**File: tests/unit/services/wsus/updates.test.ts**

**Test Suite: getPendingUpdates()**

1. "should parse pending updates correctly" - Verify all fields
2. "should filter out updates without ID"
3. "should return empty array on failure"
4. "should handle single update (non-array) response"

**Test Suite: approveUpdates()**

5. "should return approval counts on success"
6. "should handle all failures"
7. "should extract JSON from mixed output" - Handle progress messages before JSON

**Test Suite: declineUpdates()**

8. "should return decline counts on success"
9. "should handle partial failures"

**Test Suite: declineSupersededUpdates()**

10. "should decline superseded updates"
11. "should handle errors during decline"
12. "should return zeros on complete failure"

**Test Suite: declineOldUpdates()**

13. "should decline updates older than specified days"
14. "should use default 90 days"
15. "should handle errors"

**Test Suite: declineDriverUpdates()**

16. "should decline driver updates"
17. "should handle errors"

**Test Suite: autoApproveSecurityUpdates()**

18. "should auto-approve security updates"
19. "should handle already-approved updates as skipped"
20. "should return zeros on failure"

### Task 3.3: maintenance.test.ts (~12 tests)

**File: tests/unit/services/wsus/maintenance.test.ts**

**Test Suite: performCleanup()**

1. "should return true on successful cleanup"
2. "should return false on failure"
3. "should handle timeout"

**Test Suite: configureProductsAndClassifications()**

4. "should configure with specified products"
5. "should use default products if none specified"
6. "should return false on failure"

**Test Suite: performHealthCheck()**

7. "should return health check results"
8. "should identify unhealthy services"
9. "should detect database issues"
10. "should return default result on failure"

**Test Suite: runFullMaintenance()**

11. "should execute all maintenance steps"
12. "should aggregate results from all steps"

### Task 3.4: connection.test.ts (~6 tests)

**File: tests/unit/services/wsus/connection.test.ts**

1. "getConnectionScript() should return localhost script by default"
2. "getConnectionScript() should include custom server/port"
3. "getConnectionScript() should include SSL flag"
4. "initialize() should return true when module available"
5. "initialize() should return false when module not found"
6. "initialize() should return false on import failure"

### Task 3.5: powershellService.test.ts (~15 tests)

**File: tests/unit/services/powershellService.test.ts**

Note: For this file, mock the electronAPI instead of the service itself.

**Test Suite: execute()**

1. "should return result from electronAPI"
2. "should pass timeout parameter"
3. "should handle missing electronAPI grace
fully"
4. "should catch and wrap errors"

**Test Suite: executeScript()**

5. "should validate script path"
6. "should reject paths over 500 chars"
7. "should sanitize parameter names"
8. "should sanitize parameter values"
9. "should construct correct command"

**Test Suite: checkModule()**

10. "should return true when module exists"
11. "should return false when module not found"
12. "should validate module name format"

**Test Suite: importModule()**

13. "should import valid module"
14. "should reject invalid module name"
15. "should handle import failure"

---

## Phase 4: Integration Tests

### Task 4.1: wsusWorkflows.test.ts (~10 tests)

**File: tests/integration/wsusWorkflows.test.ts**

Uses fixtures from wsusResponses.ts to simulate realistic multi-step workflows.

**Test Suite: Full Maintenance Cycle**

1. "should complete full maintenance cycle successfully"
   - Mock responses for: declineSuperseded, declineOld, autoApprove, cleanup
   - Verify all steps called in order
   - Verify aggregated results

2. "should handle partial failures gracefully"
   - One step fails, others continue
   
3. "should log progress throughout cycle"

**Test Suite: Telemetry Refresh**

4. "should refresh stats and computers together"
5. "should use cached data on partial failure"
6. "should timeout after configured duration"

**Test Suite: Bulk Operations**

7. "should process bulk sync for multiple computers"
8. "should handle mixed success/failure in batch"

**Test Suite: Health Monitoring**

9. "should detect degraded environment"
10. "should identify critical issues"

### Task 4.2: Test Fixtures

**File: tests/integration/fixtures/wsusResponses.ts**

Export realistic response objects:

- HEALTHY_ENVIRONMENT: Stats with 50 healthy computers
- DEGRADED_ENVIRONMENT: Mix of healthy/warning/critical
- COMPUTER_LIST: Array of 5 realistic computer objects
- PENDING_UPDATES: Array of 10 update objects
- MAINTENANCE_RESULTS: decline/approve counts
- HEALTH_CHECK_HEALTHY: All services running
- HEALTH_CHECK_DEGRADED: Some services stopped
- ERROR_RESPONSES: Various failure scenarios

---

## Phase 5: GitHub Actions CI

### Task 5.1: Create Workflow

**File: .github/workflows/test.yml**

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        if: always()

  powershell-tests:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Pester
        shell: pwsh
        run: Install-Module -Name Pester -Force -SkipPublisherCheck
      - name: Run Pester Tests
        shell: pwsh
        run: ./tests/powershell/Run-WSUSTests.ps1

  e2e-tests:
    runs-on: windows-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
```

---

## Phase 6: Implementation Checklist

### Task Breakdown with Estimates

| Task | File(s) | Est. Hours | Priority |
|------|---------|------------|----------|
| 1.1 Update jest.config.js | jest.config.js | 0.5 | HIGH |
| 1.2 Create tests/setup.ts | tests/setup.ts | 1.0 | HIGH |
| 1.3 Create directory structure | multiple | 0.5 | HIGH |
| 2.1 Create PS mock | __mocks__/powershellService.ts | 1.0 | HIGH |
| 2.2 Create logging mock | __mocks__/loggingService.ts | 0.5 | HIGH |
| 3.1 computers.test.ts | computers.test.ts | 2.5 | HIGH |
| 3.2 updates.test.ts | updates.test.ts | 3.0 | HIGH |
| 3.3 maintenance.test.ts | maintenance.test.ts | 2.0 | MEDIUM |
| 3.4 connection.test.ts | connection.test.ts | 1.0 | MEDIUM |
| 3.5 powershellService.test.ts | powershellService.test.ts | 2.0 | HIGH |
| 4.1 wsusWorkflows.test.ts | wsusWorkflows.test.ts | 2.0 | MEDIUM |
| 4.2 Test fixtures | fixtures/wsusResponses.ts | 1.0 | MEDIUM |
| 5.1 GitHub Actions | .github/workflows/test.yml | 1.0 | HIGH |
| **TOTAL** | - | **18 hours** | - |

### Acceptance Criteria

- [ ] All new tests pass locally
- [ ] Coverage meets thresholds (80%/90%)
- [ ] No TypeScript errors
- [ ] GitHub Actions workflow runs successfully
- [ ] Existing 17 Pester tests still pass
- [ ] Existing 10 Playwright tests still pass
- [ ] npm test runs in under 60 seconds

### Test Count Summary

| Category | Count |
|----------|-------|
| Existing Pester | 17 |
| Existing E2E | 10 |
| Existing Jest (domain) | 19 |
| New Unit Tests | ~68 |
| New Integration Tests | ~10 |
| **TOTAL** | **~124** |

---

## Appendix A: Sample Test Code

### computers.test.ts Example

```typescript
import { getComputers, getStats } from '../../../../services/wsus/computers';
import { HealthStatus } from '../../../../types';

jest.mock('../../../../services/powershellService');
jest.mock('../../../../services/loggingService');

import { 
  powershellService, 
  createJsonResult, 
  createFailureResult 
} from '../__mocks__/powershellService';

describe('WSUS Computers Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getComputers()', () => {
    it('should parse single computer response', async () => {
      (powershellService.execute as jest.Mock).mockResolvedValue(
        createJsonResult({
          Name: 'PC001.corp.local',
          IPAddress: '192.168.1.100',
          OS: 'Windows 10 Pro',
          Status: 'Healthy',
          LastSync: '2024-01-15 10:30',
          UpdatesNeeded: 5,
          UpdatesInstalled: 120,
          TargetGroup: 'Workstations'
        })
      );

      const computers = await getComputers();
      
      expect(computers).toHaveLength(1);
      expect(computers[0]).toMatchObject({
        name: 'PC001.corp.local',
        status: HealthStatus.HEALTHY,
        updatesNeeded: 5
      });
    });

    it('should return empty array on failure', async () => {
      (powershellService.execute as jest.Mock).mockResolvedValue(
        createFailureResult('WSUS not available')
      );

      const computers = await getComputers();
      expect(computers).toEqual([]);
    });

    const statusCases = [
      ['Healthy', HealthStatus.HEALTHY],
      ['healthy', HealthStatus.HEALTHY],
      ['Warning', HealthStatus.WARNING],
      ['Critical', HealthStatus.CRITICAL],
      ['Unknown', HealthStatus.UNKNOWN],
      ['', HealthStatus.UNKNOWN],
    ];

    test.each(statusCases)(
      'should map status "%s" to %s',
      async (input, expected) => {
        (powershellService.execute as jest.Mock).mockResolvedValue(
          createJsonResult({ Name: 'PC', Status: input })
        );
        const computers = await getComputers();
        expect(computers[0].status).toBe(expected);
      }
    );
  });
});
```

### Mock Helper Example

```typescript
// tests/unit/services/__mocks__/powershellService.ts
import type { PowerShellResult } from '../../../../types';

export const powershellService = {
  execute: jest.fn(),
  checkModule: jest.fn(),
  importModule: jest.fn(),
  executeScript: jest.fn(),
};

export function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

export function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

export function createJsonResult<T>(data: T): PowerShellResult {
  return createSuccessResult(JSON.stringify(data));
}
```

---

## Appendix B: Fixture Data Example

```typescript
// tests/integration/fixtures/wsusResponses.ts

export const COMPUTER_LIST = [
  {
    Name: 'PC001.corp.local',
    IPAddress: '192.168.1.101',
    OS: 'Windows 10 Enterprise',
    Status: 'Healthy',
    LastSync: '2024-01-15 10:30',
    UpdatesNeeded: 0,
    UpdatesInstalled: 150,
    TargetGroup: 'Workstations'
  },
  {
    Name: 'PC002.co
rp.local',
    IPAddress: '192.168.1.102',
    OS: 'Windows 11 Pro',
    Status: 'Warning',
    LastSync: '2024-01-10 08:15',
    UpdatesNeeded: 5,
    UpdatesInstalled: 145,
    TargetGroup: 'Workstations'
  },
  {
    Name: 'SVR001.corp.local',
    IPAddress: '192.168.1.10',
    OS: 'Windows Server 2022',
    Status: 'Critical',
    LastSync: '2023-12-01 14:00',
    UpdatesNeeded: 25,
    UpdatesInstalled: 100,
    TargetGroup: 'Servers'
  }
];

export const HEALTHY_STATS = {
  TotalComputers: 50,
  HealthyComputers: 45,
  WarningComputers: 4,
  CriticalComputers: 1,
  TotalUpdates: 2500,
  SecurityUpdatesCount: 350,
  WsusServiceStatus: 'Running',
  SqlServiceStatus: 'Running',
  IISServiceStatus: 'Running'
};

export const MAINTENANCE_RESULTS = {
  declineSuperseded: { Declined: 150, Errors: 0 },
  declineOld: { Declined: 75, Errors: 2 },
  autoApprove: { Approved: 25, Skipped: 10, Errors: 0 }
};
```

---

## Next Steps

To begin implementation, inform the user to switch to implementation mode.

**Implementation Order (Recommended):**

1. **Day 1 (6 hours)**
   - Phase 1: Test infrastructure setup
   - Phase 2: Mock infrastructure
   - Task 3.1: computers.test.ts

2. **Day 2 (6 hours)**
   - Task 3.2: updates.test.ts
   - Task 3.5: powershellService.test.ts

3. **Day 3 (6 hours)**
   - Task 3.3: maintenance.test.ts
   - Task 3.4: connection.test.ts
   - Phase 4: Integration tests
   - Phase 5: GitHub Actions CI
   - Verification and acceptance testing

---

**Plan Status:** COMPLETE  
**Ready for Implementation:** YES
