/**
 * Unit Tests for STIG Compliance Service
 * Tests compliance checking, result application, and statistics
 */

import type { PowerShellResult } from '../../../../types';
import type { StigRule, StigBenchmark, ComplianceStats } from '../../../../services/stig/types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();

jest.mock('../../../../services/powershellService', () => ({
  powershellService: {
    execute: mockExecute,
  }
}));

jest.mock('../../../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock checkMappings to have predictable behavior
jest.mock('../../../../services/stig/checkMappings', () => ({
  checkMappings: [
    {
      pattern: /test-pattern-match/i,
      command: () => 'Write-Output "COMPLIANT"'
    }
  ]
}));

// Mock parser's generateGenericCheck
jest.mock('../../../../services/stig/parser', () => ({
  generateGenericCheck: jest.fn((rule) => {
    if (rule.checkContent.includes('generic-auto')) {
      return 'Write-Output "COMPLIANT"';
    }
    return null;
  })
}));

// Import after mocking
import { runComplianceChecks, applyComplianceResults, getComplianceStats } from '../../../../services/stig/compliance';

// Helper functions
function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

// Factory for creating test rules
function createTestRule(overrides: Partial<StigRule> = {}): StigRule {
  return {
    id: `V-${Math.floor(Math.random() * 100000)}`,
    vulnId: 'V-12345',
    ruleId: 'SV-12345',
    stigId: 'test-stig',
    title: 'Test Rule',
    severity: 'CAT II',
    description: 'Test description',
    checkContent: 'Verify the setting',
    fixText: 'Configure the setting',
    checkType: 'auto',
    status: 'Not Checked',
    ...overrides,
  };
}

// Factory for creating test benchmarks
function createTestBenchmark(overrides: Partial<StigBenchmark> = {}): StigBenchmark {
  return {
    id: 'test-benchmark',
    title: 'Test Benchmark',
    version: 'V1R1',
    releaseDate: '2024-01-01',
    description: 'Test benchmark description',
    fileName: 'C:/STIGs/test.xml',
    ruleCount: 0,
    rules: [],
    ...overrides,
  };
}

describe('STIG Compliance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // runComplianceChecks() Tests
  // =========================================================================
  describe('runComplianceChecks()', () => {
    
    describe('status mapping from PowerShell output', () => {
      it('should map "COMPLIANT" output to Compliant status', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('COMPLIANT'));
        
        const results = await runComplianceChecks([benchmark]);
        
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('Compliant');
      });

      it('should map "OPEN" output to Open status', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('OPEN'));
        
        const results = await runComplianceChecks([benchmark]);
        expect(results[0].status).toBe('Open');
      });

      it('should map "NOT COMPLIANT" output to Open status', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('NOT COMPLIANT'));
        
        const results = await runComplianceChecks([benchmark]);
        expect(results[0].status).toBe('Open');
      });

      it('should map "NOT_APPLICABLE" output to Not Applicable status', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('NOT_APPLICABLE'));
        
        const results = await runComplianceChecks([benchmark]);
        expect(results[0].status).toBe('Not Applicable');
      });

      it('should map "N/A" output to Not Applicable status', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('N/A'));
        
        const results = await runComplianceChecks([benchmark]);
        expect(results[0].status).toBe('Not Applicable');
      });

      it('should map unexpected output to Not Checked status', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('UNEXPECTED_VALUE'));
        
        const results = await runComplianceChecks([benchmark]);
        expect(results[0].status).toBe('Not Checked');
      });

      it('should be case-insensitive for status mapping', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('compliant'));
        
        const results = await runComplianceChecks([benchmark]);
        expect(results[0].status).toBe('Compliant');
      });
    });

    describe('manual check handling', () => {
      it('should skip execution for manual checks and mark as Not Checked', async () => {
        const rule = createTestRule({ checkType: 'manual' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        const results = await runComplianceChecks([benchmark]);
        
        expect(results[0].status).toBe('Not Checked');
        expect(mockExecute).not.toHaveBeenCalled();
      });

      it('should set lastChecked date for manual checks', async () => {
        const rule = createTestRule({ checkType: 'manual' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        const before = new Date();
        const results = await runComplianceChecks([benchmark]);
        const after = new Date();
        
        expect(results[0].lastChecked).toBeDefined();
        expect(results[0].lastChecked!.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(results[0].lastChecked!.getTime()).toBeLessThanOrEqual(after.getTime());
      });
    });

    describe('error handling', () => {
      it('should mark rule as Error when PowerShell execution fails', async () => {
        const rule = createTestRule({ checkContent: 'test-pattern-match' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockRejectedValue(new Error('PowerShell error'));
        
        const results = await runComplianceChecks([benchmark]);
        expect(results[0].status).toBe('Error');
      });

      it('should continue processing other rules after error', async () => {
        const rules = [
          createTestRule({ id: 'V-001', checkContent: 'test-pattern-match' }),
          createTestRule({ id: 'V-002', checkContent: 'test-pattern-match' }),
        ];
        const benchmark = createTestBenchmark({ rules, ruleCount: 2 });
        
        mockExecute
          .mockRejectedValueOnce(new Error('First fails'))
          .mockResolvedValueOnce(createSuccessResult('COMPLIANT'));
        
        const results = await runComplianceChecks([benchmark]);
        
        expect(results).toHaveLength(2);
        expect(results[0].status).toBe('Error');
        expect(results[1].status).toBe('Compliant');
      });
    });

    describe('benchmark filtering', () => {
      it('should check only specified benchmark when benchmarkId provided', async () => {
        const benchmark1 = createTestBenchmark({
          id: 'benchmark-1',
          rules: [createTestRule({ checkContent: 'test-pattern-match' })],
          ruleCount: 1
        });
        const benchmark2 = createTestBenchmark({
          id: 'benchmark-2',
          rules: [createTestRule({ checkContent: 'test-pattern-match' })],
          ruleCount: 1
        });
        
        mockExecute.mockResolvedValue(createSuccessResult('COMPLIANT'));
        
        const results = await runComplianceChecks([benchmark1, benchmark2], 'benchmark-1');
        
        expect(results).toHaveLength(1);
        expect(mockExecute).toHaveBeenCalledTimes(1);
      });

      it('should return empty array when benchmarkId not found', async () => {
        const benchmark = createTestBenchmark({ id: 'existing' });
        
        const results = await runComplianceChecks([benchmark], 'non-existent');
        
        expect(results).toEqual([]);
      });

      it('should check all benchmarks when no benchmarkId provided', async () => {
        const benchmarks = [
          createTestBenchmark({
            id: 'b1',
            rules: [createTestRule({ checkContent: 'test-pattern-match' })],
            ruleCount: 1
          }),
          createTestBenchmark({
            id: 'b2',
            rules: [createTestRule({ checkContent: 'test-pattern-match' })],
            ruleCount: 1
          }),
        ];
        
        mockExecute.mockResolvedValue(createSuccessResult('COMPLIANT'));
        
        const results = await runComplianceChecks(benchmarks);
        
        expect(results).toHaveLength(2);
      });
    });

    describe('no matching check command', () => {
      it('should mark as Not Checked when no pattern matches and no generic check', async () => {
        const rule = createTestRule({ checkContent: 'no-match-for-anything' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        const results = await runComplianceChecks([benchmark]);
        
        expect(results[0].status).toBe('Not Checked');
        expect(mockExecute).not.toHaveBeenCalled();
      });

      it('should use generic check when pattern match fails', async () => {
        const rule = createTestRule({ checkContent: 'generic-auto content' });
        const benchmark = createTestBenchmark({ rules: [rule], ruleCount: 1 });
        
        mockExecute.mockResolvedValue(createSuccessResult('COMPLIANT'));
        
        const results = await runComplianceChecks([benchmark]);
        
        expect(results[0].status).toBe('Compliant');
        expect(mockExecute).toHaveBeenCalled();
      });
    });

    describe('lastChecked timestamp', () => {
      it('should set lastChecked for all processed rules', async () => {
        const rules = [
          createTestRule({ checkType: 'auto', checkContent: 'test-pattern-match' }),
          createTestRule({ checkType: 'manual' }),
        ];
        const benchmark = createTestBenchmark({ rules, ruleCount: 2 });
        
        mockExecute.mockResolvedValue(createSuccessResult('COMPLIANT'));
        
        const results = await runComplianceChecks([benchmark]);
        
        expect(results[0].lastChecked).toBeInstanceOf(Date);
        expect(results[1].lastChecked).toBeInstanceOf(Date);
      });
    });
  });

  // =========================================================================
  // applyComplianceResults() Tests
  // =========================================================================
  describe('applyComplianceResults()', () => {
    
    it('should update benchmark rules with matching results', () => {
      const rule = createTestRule({ id: 'V-001', stigId: 'bench-1', status: 'Not Checked' });
      const benchmark = createTestBenchmark({ id: 'bench-1', rules: [rule], ruleCount: 1 });
      
      const result = { ...rule, status: 'Compliant' as const };
      
      applyComplianceResults([benchmark], [result]);
      
      expect(benchmark.rules[0].status).toBe('Compliant');
    });

    it('should match results by both rule id and stigId', () => {
      const rule1 = createTestRule({ id: 'V-001', stigId: 'bench-1' });
      const rule2 = createTestRule({ id: 'V-001', stigId: 'bench-2' }); // Same id, different stig
      
      const benchmark1 = createTestBenchmark({ id: 'bench-1', rules: [rule1] });
      const benchmark2 = createTestBenchmark({ id: 'bench-2', rules: [rule2] });
      
      const result = { ...rule1, stigId: 'bench-1', status: 'Compliant' as const };
      
      applyComplianceResults([benchmark1, benchmark2], [result]);
      
      expect(benchmark1.rules[0].status).toBe('Compliant');
      expect(benchmark2.rules[0].status).toBe('Not Checked'); // Should not be updated
    });

    it('should not modify rules without matching results', () => {
      const rule = createTestRule({ id: 'V-001', status: 'Not Checked' });
      const benchmark = createTestBenchmark({ id: 'bench-1', rules: [rule], ruleCount: 1 });
      
      const unmatchedResult = createTestRule({ id: 'V-999', stigId: 'bench-1', status: 'Compliant' });
      
      applyComplianceResults([benchmark], [unmatchedResult]);
      
      expect(benchmark.rules[0].status).toBe('Not Checked');
    });

    it('should handle empty results array', () => {
      const rule = createTestRule({ status: 'Not Checked' });
      const benchmark = createTestBenchmark({ rules: [rule] });
      
      applyComplianceResults([benchmark], []);
      
      expect(benchmark.rules[0].status).toBe('Not Checked');
    });

    it('should handle empty benchmarks array', () => {
      const result = createTestRule({ status: 'Compliant' });
      
      // Should not throw
      expect(() => applyComplianceResults([], [result])).not.toThrow();
    });
  });

  // =========================================================================
  // getComplianceStats() Tests
  // =========================================================================
  describe('getComplianceStats()', () => {
    
    it('should count all status types correctly', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Open' }),
        createTestRule({ status: 'Not Checked' }),
        createTestRule({ status: 'Not Applicable' }),
        createTestRule({ status: 'Error' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      expect(stats.total).toBe(6);
      expect(stats.compliant).toBe(2);
      expect(stats.open).toBe(1);
      expect(stats.notChecked).toBe(1);
      expect(stats.notApplicable).toBe(1);
      expect(stats.error).toBe(1);
    });

    it('should calculate compliance rate correctly', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Open' }),
        createTestRule({ status: 'Open' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      // 2 compliant out of 4 checkable = 50%
      expect(stats.rate).toBe(50);
    });

    it('should exclude Not Applicable from rate calculation', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Open' }),
        createTestRule({ status: 'Not Applicable' }),
        createTestRule({ status: 'Not Applicable' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      // 1 compliant out of 2 checkable (excluding 2 N/A) = 50%
      expect(stats.rate).toBe(50);
    });

    it('should exclude Not Checked from rate calculation', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Not Checked' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      // 2 compliant out of 2 checkable (excluding 1 Not Checked) = 100%
      expect(stats.rate).toBe(100);
    });

    it('should exclude Error from rate calculation', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Open' }),
        createTestRule({ status: 'Error' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      // 1 compliant out of 2 checkable = 50%
      expect(stats.rate).toBe(50);
    });

    it('should return 0 rate when no checkable rules exist', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Not Applicable' }),
        createTestRule({ status: 'Not Checked' }),
        createTestRule({ status: 'Error' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      expect(stats.rate).toBe(0);
    });

    it('should handle empty rules array', () => {
      const stats = getComplianceStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.compliant).toBe(0);
      expect(stats.open).toBe(0);
      expect(stats.rate).toBe(0);
    });

    it('should return 100% when all checkable rules are compliant', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Compliant' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      expect(stats.rate).toBe(100);
    });

    it('should return 0% when no rules are compliant', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Open' }),
        createTestRule({ status: 'Open' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      expect(stats.rate).toBe(0);
    });

    it('should round compliance rate to nearest integer', () => {
      const rules: StigRule[] = [
        createTestRule({ status: 'Compliant' }),
        createTestRule({ status: 'Open' }),
        createTestRule({ status: 'Open' }),
      ];
      
      const stats = getComplianceStats(rules);
      
      // 1/3 = 33.33... should round to 33
      expect(stats.rate).toBe(33);
    });
  });
});
