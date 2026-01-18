/**
 * Unit Tests for STIG Check Mappings
 * Tests pattern matching for automated compliance checks
 */

import type { StigRule } from '../../../../services/stig/types';
import { checkMappings } from '../../../../services/stig/checkMappings';

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
    checkContent: '',
    fixText: 'Configure the setting',
    checkType: 'auto',
    status: 'Not Checked',
    ...overrides,
  };
}

describe('STIG Check Mappings', () => {
  
  // =========================================================================
  // Service Running Checks
  // =========================================================================
  describe('service running pattern', () => {
    const servicePattern = checkMappings.find(m => 
      m.pattern.source.includes('service') && m.pattern.source.includes('running')
    );

    it('should exist in mappings', () => {
      expect(servicePattern).toBeDefined();
    });

    it('should match "Verify service WsusService is running"', () => {
      const content = 'Verify the service "WsusService" is running';
      const match = content.match(servicePattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should match "service started" pattern', () => {
      const content = 'The W3SVC service must be started';
      const match = content.match(servicePattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should match "service enabled" pattern', () => {
      const content = 'Verify the MSSQLSERVER service is enabled';
      const match = content.match(servicePattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should generate PowerShell with Get-Service', () => {
      const content = 'Verify the service "TestService" is running';
      const match = content.match(servicePattern!.pattern)!;
      const rule = createTestRule();
      const command = servicePattern!.command(match, rule);
      
      expect(command).toContain('Get-Service');
      expect(command).toContain('COMPLIANT');
      expect(command).toContain('OPEN');
    });
  });

  // =========================================================================
  // Registry Value Checks
  // =========================================================================
  describe('registry value pattern', () => {
    const registryPattern = checkMappings.find(m => 
      m.pattern.source.includes('registry') && m.pattern.source.includes('HKLM')
    );

    it('should exist in mappings', () => {
      expect(registryPattern).toBeDefined();
    });

    it('should match HKLM registry path with value check', () => {
      const content = 'Verify registry HKLM:\\SOFTWARE\\Microsoft\\Windows value "Enabled" is set to "1"';
      const match = content.match(registryPattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should generate PowerShell with Get-ItemProperty', () => {
      const content = 'Check registry HKLM:\\SOFTWARE\\Policies value DisabledByDefault equal 0';
      const match = content.match(registryPattern!.pattern);
      
      if (match) {
        const rule = createTestRule();
        const command = registryPattern!.command(match, rule);
        
        expect(command).toContain('Get-ItemProperty');
        expect(command).toContain('HKLM:');
      }
    });
  });

  // =========================================================================
  // Windows Feature Checks
  // =========================================================================
  describe('windows feature pattern', () => {
    const featurePattern = checkMappings.find(m => 
      m.pattern.source.includes('feature') || m.pattern.source.includes('role')
    );

    it('should exist in mappings', () => {
      expect(featurePattern).toBeDefined();
    });

    it('should match "feature installed" pattern', () => {
      const content = 'Verify the Windows-Defender feature is installed';
      const match = content.match(featurePattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should match "role enabled" pattern', () => {
      const content = 'The Web-Server role must be enabled';
      const match = content.match(featurePattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should generate PowerShell with Get-WindowsFeature', () => {
      const content = 'Verify feature "UpdateServices" is installed';
      const match = content.match(featurePattern!.pattern)!;
      const rule = createTestRule();
      const command = featurePattern!.command(match, rule);
      
      expect(command).toContain('Get-WindowsFeature');
      expect(command).toContain('Installed');
    });
  });

  // =========================================================================
  // Firewall Checks
  // =========================================================================
  describe('firewall pattern', () => {
    const firewallPattern = checkMappings.find(m => 
      m.pattern.source.toLowerCase().includes('firewall')
    );

    it('should exist in mappings', () => {
      expect(firewallPattern).toBeDefined();
    });

    it('should match "Windows Firewall enabled" pattern', () => {
      const content = 'Windows Firewall must be enabled for all profiles';
      const match = content.match(firewallPattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should match "firewall profile" pattern', () => {
      const content = 'The firewall profile must be on';
      const match = content.match(firewallPattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should generate PowerShell with Get-NetFirewallProfile', () => {
      const content = 'Windows Firewall must be enabled';
      const match = content.match(firewallPattern!.pattern)!;
      const rule = createTestRule();
      const command = firewallPattern!.command(match, rule);
      
      expect(command).toContain('Get-NetFirewallProfile');
      expect(command).toContain('Enabled');
    });
  });

  // =========================================================================
  // Audit Policy Checks
  // =========================================================================
  describe('audit policy pattern', () => {
    const auditPattern = checkMappings.find(m => 
      m.pattern.source.includes('audit')
    );

    it('should exist in mappings', () => {
      expect(auditPattern).toBeDefined();
    });

    it('should match "audit success" pattern', () => {
      const content = 'Audit "Logon" must be configured for success events';
      const match = content.match(auditPattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should match "audit failure" pattern', () => {
      const content = 'Audit Account Management failure must be enabled';
      const match = content.match(auditPattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should generate PowerShell with auditpol', () => {
      const content = 'Audit "Security State Change" must be enabled';
      const match = content.match(auditPattern!.pattern)!;
      const rule = createTestRule();
      const command = auditPattern!.command(match, rule);
      
      expect(command).toContain('auditpol');
      expect(command).toContain('/get');
    });
  });

  // =========================================================================
  // Password/Account Policy Checks
  // =========================================================================
  describe('password policy pattern', () => {
    const passwordPattern = checkMappings.find(m => 
      m.pattern.source.includes('password') || m.pattern.source.includes('account')
    );

    it('should exist in mappings', () => {
      expect(passwordPattern).toBeDefined();
    });

    it('should match "password policy" pattern', () => {
      const content = 'The password policy must enforce minimum length';
      const match = content.match(passwordPattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should match "account lockout" pattern', () => {
      const content = 'Account lockout policy must be configured';
      const match = content.match(passwordPattern!.pattern);
      
      expect(match).not.toBeNull();
    });

    it('should generate PowerShell with secedit', () => {
      const content = 'Password policy settings must be configured';
      const match = content.match(passwordPattern!.pattern)!;
      const rule = createTestRule();
      const command = passwordPattern!.command(match, rule);
      
      expect(command).toContain('secedit');
      expect(command).toContain('MinimumPasswordLength');
    });
  });

  // =========================================================================
  // General Pattern Behavior
  // =========================================================================
  describe('general pattern behavior', () => {
    it('should have at least 5 check mappings', () => {
      expect(checkMappings.length).toBeGreaterThanOrEqual(5);
    });

    it('all mappings should have pattern and command', () => {
      for (const mapping of checkMappings) {
        expect(mapping.pattern).toBeInstanceOf(RegExp);
        expect(typeof mapping.command).toBe('function');
      }
    });

    it('all command functions should return strings', () => {
      const testContent = 'service WsusService is running';
      
      for (const mapping of checkMappings) {
        const match = testContent.match(mapping.pattern);
        if (match) {
          const rule = createTestRule();
          const command = mapping.command(match, rule);
          expect(typeof command).toBe('string');
        }
      }
    });

    it('patterns should be case-insensitive', () => {
      for (const mapping of checkMappings) {
        expect(mapping.pattern.flags).toContain('i');
      }
    });
  });

  // =========================================================================
  // Output Format Validation
  // =========================================================================
  describe('output format validation', () => {
    it('all commands should output COMPLIANT or OPEN', () => {
      const testCases = [
        { content: 'service WsusService is running', desc: 'service check' },
        { content: 'Windows Firewall must be enabled', desc: 'firewall check' },
        { content: 'feature UpdateServices is installed', desc: 'feature check' },
      ];

      for (const { content } of testCases) {
        for (const mapping of checkMappings) {
          const match = content.match(mapping.pattern);
          if (match) {
            const rule = createTestRule();
            const command = mapping.command(match, rule);
            
            // Command should include both possible outputs
            const hasCompliant = command.includes('COMPLIANT');
            const hasOpen = command.includes('OPEN');
            
            expect(hasCompliant || hasOpen).toBe(true);
            break;
          }
        }
      }
    });
  });
});
