/**
 * Unit Tests for STIG Export Service
 * Tests CSV export and content generation
 */

import type { PowerShellResult } from '../../../../types';
import type { StigRule } from '../../../../services/stig/types';

// Mock the services with inline mock functions
const mockExecute = jest.fn<Promise<PowerShellResult>, [string, number?]>();

jest.mock('../../../../services/powershellService', () => ({
  powershellService: {
    execute: mockExecute,
  }
}));

// Import after mocking
import { exportResults, generateCsvContent } from '../../../../services/stig/export';

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
    id: 'V-12345',
    vulnId: 'V-12345',
    ruleId: 'SV-12345',
    stigId: 'test-stig',
    title: 'Test Rule Title',
    severity: 'CAT II',
    description: 'Test description',
    checkContent: 'Verify the setting',
    fixText: 'Configure the setting',
    checkType: 'auto',
    status: 'Not Checked',
    ...overrides,
  };
}

describe('STIG Export Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // exportResults() Tests
  // =========================================================================
  describe('exportResults()', () => {
    
    describe('successful export', () => {
      it('should return true on successful file write', async () => {
        mockExecute.mockResolvedValue(createSuccessResult('SUCCESS'));
        
        const rules = [createTestRule()];
        const result = await exportResults(rules, 'C:/output/report.csv');
        
        expect(result).toBe(true);
      });

      it('should pass correct path to PowerShell', async () => {
        mockExecute.mockResolvedValue(createSuccessResult('SUCCESS'));
        
        await exportResults([createTestRule()], 'C:/Reports/stig_results.csv');
        
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('C:/Reports/stig_results.csv'),
          30000
        );
      });

      it('should escape backslashes in output path', async () => {
        mockExecute.mockResolvedValue(createSuccessResult('SUCCESS'));
        
        await exportResults([createTestRule()], 'C:\\Reports\\results.csv');
        
        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('C:\\\\Reports\\\\results.csv'),
          30000
        );
      });
    });

    describe('error handling', () => {
      it('should return false on PowerShell failure', async () => {
        mockExecute.mockResolvedValue(createFailureResult('Access denied'));
        
        const result = await exportResults([createTestRule()], 'C:/output.csv');
        
        expect(result).toBe(false);
      });

      it('should return false when output does not contain SUCCESS', async () => {
        mockExecute.mockResolvedValue(createSuccessResult('File created'));
        
        const result = await exportResults([createTestRule()], 'C:/output.csv');
        
        expect(result).toBe(false);
      });
    });

    describe('CSV content formatting', () => {
      it('should include all rule fields in export', async () => {
        mockExecute.mockResolvedValue(createSuccessResult('SUCCESS'));
        
        const rule = createTestRule({
          vulnId: 'V-99999',
          ruleId: 'SV-99999',
          stigId: 'windows-stig',
          title: 'Check WSUS Service',
          severity: 'CAT I',
          status: 'Compliant',
          checkType: 'auto',
        });
        
        await exportResults([rule], 'C:/output.csv');
        
        const call = mockExecute.mock.calls[0][0];
        expect(call).toContain('V-99999');
        expect(call).toContain('SV-99999');
        expect(call).toContain('windows-stig');
        expect(call).toContain('Check WSUS Service');
        expect(call).toContain('CAT I');
        expect(call).toContain('Compliant');
        expect(call).toContain('auto');
      });

      it('should escape double quotes in title', async () => {
        mockExecute.mockResolvedValue(createSuccessResult('SUCCESS'));
        
        const rule = createTestRule({
          title: 'Rule with "quoted" text',
        });
        
        await exportResults([rule], 'C:/output.csv');
        
        const call = mockExecute.mock.calls[0][0];
        // Double quotes should be doubled for CSV escaping
        expect(call).toContain('""quoted""');
      });
    });
  });

  // =========================================================================
  // generateCsvContent() Tests
  // =========================================================================
  describe('generateCsvContent()', () => {
    
    describe('header generation', () => {
      it('should include all column headers', () => {
        const rules = [createTestRule()];
        const csv = generateCsvContent(rules);
        
        const headers = csv.split('\n')[0];
        expect(headers).toContain('Vuln ID');
        expect(headers).toContain('Rule ID');
        expect(headers).toContain('STIG');
        expect(headers).toContain('Title');
        expect(headers).toContain('Severity');
        expect(headers).toContain('Status');
        expect(headers).toContain('Check Type');
        expect(headers).toContain('Last Checked');
      });
    });

    describe('row generation', () => {
      it('should generate correct row for single rule', () => {
        const rule = createTestRule({
          vulnId: 'V-12345',
          ruleId: 'SV-12345',
          stigId: 'test-stig',
          title: 'Test Rule',
          severity: 'CAT II',
          status: 'Compliant',
          checkType: 'auto',
          lastChecked: new Date('2024-01-15T10:30:00Z'),
        });
        
        const csv = generateCsvContent([rule]);
        const lines = csv.split('\n');
        
        expect(lines).toHaveLength(2); // Header + 1 row
        expect(lines[1]).toContain('"V-12345"');
        expect(lines[1]).toContain('"SV-12345"');
        expect(lines[1]).toContain('"test-stig"');
        expect(lines[1]).toContain('"Test Rule"');
        expect(lines[1]).toContain('"CAT II"');
        expect(lines[1]).toContain('"Compliant"');
        expect(lines[1]).toContain('"auto"');
        expect(lines[1]).toContain('2024-01-15');
      });

      it('should generate multiple rows for multiple rules', () => {
        const rules = [
          createTestRule({ vulnId: 'V-001' }),
          createTestRule({ vulnId: 'V-002' }),
          createTestRule({ vulnId: 'V-003' }),
        ];
        
        const csv = generateCsvContent(rules);
        const lines = csv.split('\n');
        
        expect(lines).toHaveLength(4); // Header + 3 rows
      });
    });

    describe('special character handling', () => {
      it('should escape double quotes in title', () => {
        const rule = createTestRule({
          title: 'Rule with "special" characters',
        });
        
        const csv = generateCsvContent([rule]);
        
        // CSV escaping: double quote becomes two double quotes
        expect(csv).toContain('""special""');
      });

      it('should handle commas in title (wrapped in quotes)', () => {
        const rule = createTestRule({
          title: 'Rule with, comma',
        });
        
        const csv = generateCsvContent([rule]);
        
        // Should be wrapped in quotes
        expect(csv).toContain('"Rule with, comma"');
      });
    });

    describe('date formatting', () => {
      it('should format lastChecked as ISO string', () => {
        const date = new Date('2024-06-15T14:30:00.000Z');
        const rule = createTestRule({ lastChecked: date });
        
        const csv = generateCsvContent([rule]);
        
        expect(csv).toContain('2024-06-15T14:30:00.000Z');
      });

      it('should show "Never" for undefined lastChecked', () => {
        const rule = createTestRule({ lastChecked: undefined });
        
        const csv = generateCsvContent([rule]);
        
        expect(csv).toContain('"Never"');
      });
    });

    describe('empty input handling', () => {
      it('should return empty string for empty rules array', () => {
        const csv = generateCsvContent([]);
        
        // Implementation derives headers from first data item
        // With no data, there's no header - returns just empty line
        expect(csv).toBe('');
      });
    });

    describe('severity values', () => {
      it('should preserve CAT I severity', () => {
        const rule = createTestRule({ severity: 'CAT I' });
        const csv = generateCsvContent([rule]);
        expect(csv).toContain('"CAT I"');
      });

      it('should preserve CAT II severity', () => {
        const rule = createTestRule({ severity: 'CAT II' });
        const csv = generateCsvContent([rule]);
        expect(csv).toContain('"CAT II"');
      });

      it('should preserve CAT III severity', () => {
        const rule = createTestRule({ severity: 'CAT III' });
        const csv = generateCsvContent([rule]);
        expect(csv).toContain('"CAT III"');
      });
    });

    describe('status values', () => {
      const statusValues: Array<StigRule['status']> = [
        'Not Checked',
        'Compliant',
        'Open',
        'Not Applicable',
        'Error',
      ];

      test.each(statusValues)('should preserve %s status', (status) => {
        const rule = createTestRule({ status });
        const csv = generateCsvContent([rule]);
        expect(csv).toContain(`"${status}"`);
      });
    });
  });
});
