/**
 * Unit Tests for Validation Utilities
 * Tests input validation functions
 */

import { 
  validateHostname, 
  validateCommandInput, 
  validateId, 
  validateTime 
} from '../../../../src/shared/utils/validation';

describe('Validation Utilities', () => {
  
  // =========================================================================
  // validateHostname() Tests
  // =========================================================================
  describe('validateHostname()', () => {
    
    describe('valid hostnames', () => {
      const validHostnames = [
        'localhost',
        'server01',
        'web-server-01',
        'db.server.local',
        'app.corp.company.com',
        'SERVER01',
        'server-01.domain.local',
        '192.168.1.1',
        'a',
        'A1',
      ];

      test.each(validHostnames)('should accept "%s"', (hostname) => {
        expect(validateHostname(hostname)).toBe(hostname);
      });
    });

    describe('invalid hostnames', () => {
      it('should reject null', () => {
        expect(validateHostname(null)).toBeNull();
      });

      it('should reject undefined', () => {
        expect(validateHostname(undefined)).toBeNull();
      });

      it('should reject empty string', () => {
        expect(validateHostname('')).toBeNull();
      });

      it('should reject hostname with spaces', () => {
        expect(validateHostname('server 01')).toBeNull();
      });

      it('should reject hostname with special characters', () => {
        expect(validateHostname('server@host')).toBeNull();
        expect(validateHostname('server!host')).toBeNull();
        expect(validateHostname('server#host')).toBeNull();
        expect(validateHostname('server$host')).toBeNull();
        expect(validateHostname('server;host')).toBeNull();
        expect(validateHostname('server|host')).toBeNull();
      });

      it('should reject hostname exceeding 255 characters', () => {
        const longHostname = 'a'.repeat(256);
        expect(validateHostname(longHostname)).toBeNull();
      });

      it('should accept hostname at exactly 255 characters', () => {
        const maxHostname = 'a'.repeat(255);
        expect(validateHostname(maxHostname)).toBe(maxHostname);
      });

      it('should reject non-string input', () => {
        expect(validateHostname(123 as any)).toBeNull();
        expect(validateHostname({} as any)).toBeNull();
        expect(validateHostname([] as any)).toBeNull();
      });
    });
  });

  // =========================================================================
  // validateCommandInput() Tests
  // =========================================================================
  describe('validateCommandInput()', () => {
    
    describe('valid inputs', () => {
      it('should accept normal command', () => {
        expect(validateCommandInput('help')).toBe(true);
      });

      it('should accept command with arguments', () => {
        expect(validateCommandInput('ping server01')).toBe(true);
      });

      it('should accept command at max length', () => {
        const maxCommand = 'a'.repeat(1000);
        expect(validateCommandInput(maxCommand)).toBe(true);
      });

      it('should accept command with special characters', () => {
        expect(validateCommandInput('echo "hello world"')).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      it('should reject empty string', () => {
        expect(validateCommandInput('')).toBe(false);
      });

      it('should reject whitespace-only string', () => {
        expect(validateCommandInput('   ')).toBe(false);
        expect(validateCommandInput('\t\n')).toBe(false);
      });

      it('should reject command exceeding max length', () => {
        const longCommand = 'a'.repeat(1001);
        expect(validateCommandInput(longCommand)).toBe(false);
      });

      it('should reject non-string input', () => {
        expect(validateCommandInput(123 as any)).toBe(false);
        expect(validateCommandInput(null as any)).toBe(false);
        expect(validateCommandInput(undefined as any)).toBe(false);
        expect(validateCommandInput({} as any)).toBe(false);
      });
    });

    describe('custom max length', () => {
      it('should respect custom max length', () => {
        expect(validateCommandInput('hello', 3)).toBe(false);
        expect(validateCommandInput('hi', 3)).toBe(true);
      });
    });
  });

  // =========================================================================
  // validateId() Tests
  // =========================================================================
  describe('validateId()', () => {
    
    describe('valid IDs', () => {
      const validIds = [
        '1',
        'abc',
        'user-123',
        'V-254239',
        'SV-254239r848544_rule',
        'a'.repeat(100), // Max length
      ];

      test.each(validIds)('should accept "%s"', (id) => {
        expect(validateId(id)).toBe(true);
      });
    });

    describe('invalid IDs', () => {
      it('should reject null', () => {
        expect(validateId(null)).toBe(false);
      });

      it('should reject undefined', () => {
        expect(validateId(undefined)).toBe(false);
      });

      it('should reject empty string', () => {
        expect(validateId('')).toBe(false);
      });

      it('should reject whitespace-only string', () => {
        expect(validateId('   ')).toBe(false);
      });

      it('should reject ID exceeding 100 characters', () => {
        const longId = 'a'.repeat(101);
        expect(validateId(longId)).toBe(false);
      });

      it('should reject non-string input', () => {
        expect(validateId(123 as any)).toBe(false);
        expect(validateId({} as any)).toBe(false);
      });
    });
  });

  // =========================================================================
  // validateTime() Tests
  // =========================================================================
  describe('validateTime()', () => {
    
    describe('valid times', () => {
      const validTimes = [
        '00:00',
        '01:30',
        '12:00',
        '13:45',
        '23:59',
        '9:30',  // Single digit hour
        '0:00',
      ];

      test.each(validTimes)('should accept "%s"', (time) => {
        expect(validateTime(time)).toBe(true);
      });
    });

    describe('invalid times', () => {
      it('should reject 24:00 (invalid hour)', () => {
        expect(validateTime('24:00')).toBe(false);
      });

      it('should reject 12:60 (invalid minutes)', () => {
        expect(validateTime('12:60')).toBe(false);
      });

      it('should reject time without colon', () => {
        expect(validateTime('1200')).toBe(false);
      });

      it('should reject time with seconds', () => {
        expect(validateTime('12:00:00')).toBe(false);
      });

      it('should reject empty string', () => {
        expect(validateTime('')).toBe(false);
      });

      it('should reject non-numeric time', () => {
        expect(validateTime('ab:cd')).toBe(false);
      });

      it('should reject negative time', () => {
        expect(validateTime('-1:00')).toBe(false);
      });

      it('should reject time with AM/PM', () => {
        expect(validateTime('12:00 PM')).toBe(false);
      });
    });
  });
});
