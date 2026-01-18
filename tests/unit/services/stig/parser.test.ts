/**
 * Unit Tests for STIG Parser Service
 * Tests XML parsing, check type determination, and generic check generation
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

jest.mock('../../../../services/loggingService', () => ({
  loggingService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

// Import after mocking
import { determineCheckType, parseXccdfFile, generateGenericCheck } from '../../../../services/stig/parser';

// Helper functions
function createSuccessResult(stdout: string): PowerShellResult {
  return { success: true, stdout, stderr: '', exitCode: 0 };
}

function createFailureResult(stderr: string): PowerShellResult {
  return { success: false, stdout: '', stderr, exitCode: 1 };
}

function createJsonResult<T>(data: T): PowerShellResult {
  return createSuccessResult(JSON.stringify(data));
}

// Factory for creating test rules
function createTestRule(overrides: Partial<StigRule> = {}): StigRule {
  return {
    id: 'V-12345',
    vulnId: 'V-12345',
    ruleId: 'SV-12345',
    stigId: 'test-stig',
    title: 'Test Rule',
    severity: 'CAT II',
    description: 'Test description',
    checkContent: 'Verify the setting is configured',
    fixText: 'Configure the setting',
    checkType: 'manual',
    status: 'Not Checked',
    ...overrides,
  };
}

describe('STIG Parser Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // determineCheckType() Tests
  // =========================================================================
  describe('determineCheckType()', () => {
    
    describe('should return "auto" for automatable patterns', () => {
      const autoPatterns = [
        { input: 'Verify the WsusService service is running', pattern: 'service running' },
        { input: 'service started automatically', pattern: 'service started' },
        { input: 'Verify service is enabled', pattern: 'service enabled' },
        { input: 'Check registry HKLM\\SOFTWARE\\Microsoft', pattern: 'registry HKLM' },
        { input: 'The feature must be installed', pattern: 'feature installed' },
        { input: 'The role should be enabled', pattern: 'role enabled' },
        { input: 'Windows Firewall must be configured', pattern: 'firewall' },
        { input: 'Audit policy for success events', pattern: 'audit success' },
        { input: 'audit failure logging', pattern: 'audit failure' },
        { input: 'Password policy must require', pattern: 'password policy' },
        { input: 'Run Get-Service to check', pattern: 'get-service' },
        { input: 'Use Get-ItemProperty to verify', pattern: 'get-itemproperty' },
        { input: 'Execute the PowerShell command', pattern: 'powershell' },
      ];

      test.each(autoPatterns)(
        'should detect "$pattern" as automatable',
        ({ input }) => {
          expect(determineCheckType(input)).toBe('auto');
        }
      );
    });

    describe('should return "manual" for non-automatable patterns', () => {
      const manualPatterns = [
        'Interview the system administrator',
        'Review the documentation',
        'Verify with the ISSO',
        'Check the physical location',
        'Manually inspect the configuration',
        'Contact the vendor for verification',
        '',
        'This is a generic check with no keywords',
      ];

      test.each(manualPatterns)(
        'should detect "%s" as manual',
        (input) => {
          expect(determineCheckType(input)).toBe('manual');
        }
      );
    });

    it('should be case-insensitive', () => {
      expect(determineCheckType('VERIFY SERVICE IS RUNNING')).toBe('auto');
      expect(determineCheckType('Registry HKLM path')).toBe('auto');
      expect(determineCheckType('FIREWALL configuration')).toBe('auto');
    });
  });

  // =========================================================================
  // parseXccdfFile() Tests
  // =========================================================================
  describe('parseXccdfFile()', () => {
    
    describe('successful parsing', () => {
      it('should parse valid XCCDF benchmark response', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({
            benchmark: {
              id: 'Windows_Server_2022_STIG',
              title: 'Windows Server 2022 STIG',
              version: 'V1R1',
              description: 'Security requirements for Windows Server 2022'
            },
            rules: [
              {
                id: 'V-254239',
                vulnId: 'V-254239',
                ruleId: 'SV-254239r848544_rule',
                title: 'Windows Server 2022 must have the WSUS service running',
                severity: 'CAT II',
                description: 'The WSUS service must be running',
                checkContent: 'Verify the WsusService service is running',
                fixText: 'Start the WsusService'
              }
            ]
          })
        );

        const result = await parseXccdfFile('C:/STIGs/windows_server_2022.xml');

        expect(result).not.toBeNull();
        expect(result!.id).toBe('Windows_Server_2022_STIG');
        expect(result!.title).toBe('Windows Server 2022 STIG');
        expect(result!.version).toBe('V1R1');
        expect(result!.rules).toHaveLength(1);
        expect(result!.rules[0].vulnId).toBe('V-254239');
        expect(result!.rules[0].checkType).toBe('auto'); // Has 'service running'
      });

      it('should parse multiple rules correctly', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({
            benchmark: { id: 'test', title: 'Test STIG', version: 'V1' },
            rules: [
              { id: 'V-001', title: 'Rule 1', severity: 'CAT I', checkContent: 'manual check' },
              { id: 'V-002', title: 'Rule 2', severity: 'CAT II', checkContent: 'service running' },
              { id: 'V-003', title: 'Rule 3', severity: 'CAT III', checkContent: 'registry HKLM' },
            ]
          })
        );

        const result = await parseXccdfFile('C:/STIGs/test.xml');

        expect(result!.rules).toHaveLength(3);
        expect(result!.rules[0].severity).toBe('CAT I');
        expect(result!.rules[0].checkType).toBe('manual');
        expect(result!.rules[1].severity).toBe('CAT II');
        expect(result!.rules[1].checkType).toBe('auto');
        expect(result!.rules[2].severity).toBe('CAT III');
        expect(result!.rules[2].checkType).toBe('auto');
      });

      it('should handle missing optional fields with defaults', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({
            benchmark: { id: null, title: null },
            rules: [{ id: null }]
          })
        );

        const result = await parseXccdfFile('C:/STIGs/minimal.xml');

        expect(result).not.toBeNull();
        expect(result!.title).toBe('Unknown STIG');
        expect(result!.rules[0].title).toBe('Unknown Rule');
        expect(result!.rules[0].status).toBe('Not Checked');
      });

      it('should store file path in benchmark', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({
            benchmark: { id: 'test', title: 'Test' },
            rules: []
          })
        );

        const filePath = 'C:/STIGs/windows.xml';
        const result = await parseXccdfFile(filePath);

        expect(result!.fileName).toBe(filePath);
      });
    });

    describe('error handling', () => {
      it('should return null on PowerShell failure', async () => {
        mockExecute.mockResolvedValue(
          createFailureResult('File not found')
        );

        const result = await parseXccdfFile('C:/nonexistent.xml');
        expect(result).toBeNull();
      });

      it('should return null on empty stdout', async () => {
        mockExecute.mockResolvedValue(
          createSuccessResult('')
        );

        const result = await parseXccdfFile('C:/empty.xml');
        expect(result).toBeNull();
      });

      it('should return null on malformed JSON', async () => {
        mockExecute.mockResolvedValue(
          createSuccessResult('not valid { json }')
        );

        const result = await parseXccdfFile('C:/invalid.xml');
        expect(result).toBeNull();
      });

      it('should return null when response contains error field', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({ error: 'Not a valid XCCDF benchmark file' })
        );

        const result = await parseXccdfFile('C:/not-xccdf.xml');
        expect(result).toBeNull();
      });
    });

    describe('path handling', () => {
      it('should escape backslashes in file path', async () => {
        mockExecute.mockResolvedValue(
          createJsonResult({ benchmark: { id: 'test' }, rules: [] })
        );

        await parseXccdfFile('C:\\STIGs\\windows\\server.xml');

        expect(mockExecute).toHaveBeenCalledWith(
          expect.stringContaining('C:\\\\STIGs\\\\windows\\\\server.xml'),
          60000
        );
      });
    });
  });

  // =========================================================================
  // generateGenericCheck() Tests
  // =========================================================================
  describe('generateGenericCheck()', () => {
    
    describe('WSUS-specific checks', () => {
      it('should generate WSUS service check', () => {
        const rule = createTestRule({
          checkContent: 'Verify the WSUS service is running',
          title: 'WSUS Service Check'
        });

        const check = generateGenericCheck(rule);

        expect(check).not.toBeNull();
        expect(check).toContain('Get-Service');
        expect(check).toContain('WsusService');
        expect(check).toContain('COMPLIANT');
        expect(check).toContain('OPEN');
      });
    });

    describe('SQL Server checks', () => {
      it('should generate SQL Server service check', () => {
        const rule = createTestRule({
          checkContent: 'Verify SQL Server service is running',
          title: 'SQL Service Check'
        });

        const check = generateGenericCheck(rule);

        expect(check).not.toBeNull();
        expect(check).toContain('MSSQL');
        expect(check).toContain('Running');
      });
    });

    describe('IIS checks', () => {
      it('should generate IIS/W3SVC check', () => {
        const rule = createTestRule({
          checkContent: 'Verify IIS is properly configured'
        });

        const check = generateGenericCheck(rule);

        expect(check).not.toBeNull();
        expect(check).toContain('W3SVC');
      });

      it('should detect W3SVC keyword', () => {
        const rule = createTestRule({
          checkContent: 'Check W3SVC service status'
        });

        const check = generateGenericCheck(rule);
        expect(check).toContain('W3SVC');
      });
    });

    describe('HTTPS/SSL/TLS checks', () => {
      it('should generate HTTPS check', () => {
        const rule = createTestRule({
          checkContent: 'Verify HTTPS is enabled for WSUS'
        });

        const check = generateGenericCheck(rule);

        expect(check).not.toBeNull();
        expect(check).toContain('UsingSSL');
      });

      it('should detect SSL keyword', () => {
        const rule = createTestRule({
          checkContent: 'SSL must be configured'
        });

        const check = generateGenericCheck(rule);
        expect(check).toContain('UsingSSL');
      });

      it('should detect TLS keyword', () => {
        const rule = createTestRule({
          checkContent: 'TLS 1.2 must be enforced'
        });

        const check = generateGenericCheck(rule);
        expect(check).toContain('UsingSSL');
      });
    });

    describe('Windows Update checks', () => {
      it('should generate Windows Update check', () => {
        const rule = createTestRule({
          checkContent: 'Windows Update must be configured'
        });

        const check = generateGenericCheck(rule);

        expect(check).not.toBeNull();
        expect(check).toContain('WindowsUpdate');
        expect(check).toContain('AUOptions');
      });

      it('should detect automatic update keyword', () => {
        const rule = createTestRule({
          checkContent: 'Automatic Update settings'
        });

        const check = generateGenericCheck(rule);
        expect(check).toContain('Auto Update');
      });
    });

    describe('no match scenarios', () => {
      it('should return null for unmatched content', () => {
        const rule = createTestRule({
          checkContent: 'Interview the administrator',
          title: 'Manual verification required'
        });

        const check = generateGenericCheck(rule);
        expect(check).toBeNull();
      });

      it('should return null for empty content', () => {
        const rule = createTestRule({
          checkContent: '',
          title: ''
        });

        const check = generateGenericCheck(rule);
        expect(check).toBeNull();
      });
    });

    describe('case insensitivity', () => {
      it('should match regardless of case', () => {
        const ruleUpper = createTestRule({ checkContent: 'WSUS SERVICE' });
        const ruleLower = createTestRule({ checkContent: 'wsus service' });
        const ruleMixed = createTestRule({ checkContent: 'Wsus Service' });

        expect(generateGenericCheck(ruleUpper)).not.toBeNull();
        expect(generateGenericCheck(ruleLower)).not.toBeNull();
        expect(generateGenericCheck(ruleMixed)).not.toBeNull();
      });
    });
  });
});
