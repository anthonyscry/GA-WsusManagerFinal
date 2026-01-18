/**
 * Unit Tests for Security Utilities
 * Tests secure ID generation and XSS sanitization
 */

import { generateSecureId, sanitizeString, sanitizeInput } from '../../../../src/shared/utils/security';

describe('Security Utilities', () => {
  
  // =========================================================================
  // generateSecureId() Tests
  // =========================================================================
  describe('generateSecureId()', () => {
    
    it('should generate ID of default length (11)', () => {
      const id = generateSecureId();
      expect(id.length).toBe(11);
    });

    it('should generate ID of specified length', () => {
      expect(generateSecureId(5).length).toBe(5);
      expect(generateSecureId(20).length).toBe(20);
      expect(generateSecureId(1).length).toBe(1);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSecureId());
      }
      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should only contain alphanumeric characters (base36)', () => {
      const id = generateSecureId(50);
      expect(/^[a-z0-9]+$/.test(id)).toBe(true);
    });

    it('should handle zero length', () => {
      const id = generateSecureId(0);
      expect(id).toBe('');
    });
  });

  // =========================================================================
  // sanitizeString() Tests
  // =========================================================================
  describe('sanitizeString()', () => {
    
    describe('XSS prevention', () => {
      it('should escape < character', () => {
        expect(sanitizeString('<script>')).toBe('&lt;script&gt;');
      });

      it('should escape > character', () => {
        expect(sanitizeString('a > b')).toBe('a &gt; b');
      });

      it('should escape double quotes', () => {
        expect(sanitizeString('say "hello"')).toBe('say &quot;hello&quot;');
      });

      it('should escape single quotes', () => {
        expect(sanitizeString("it's")).toBe("it&#x27;s");
      });

      it('should escape all dangerous characters together', () => {
        const input = '<script>alert("xss")</script>';
        const result = sanitizeString(input);
        
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
        expect(result).not.toContain('"');
        expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      });
    });

    describe('length limiting', () => {
      it('should truncate at default max length (10000)', () => {
        const longString = 'a'.repeat(15000);
        const result = sanitizeString(longString);
        expect(result.length).toBe(10000);
      });

      it('should truncate at specified max length', () => {
        const result = sanitizeString('hello world', 5);
        expect(result).toBe('hello');
      });

      it('should not truncate strings under max length', () => {
        const result = sanitizeString('hello', 100);
        expect(result).toBe('hello');
      });
    });

    describe('safe strings', () => {
      it('should not modify alphanumeric strings', () => {
        expect(sanitizeString('Hello123')).toBe('Hello123');
      });

      it('should preserve spaces', () => {
        expect(sanitizeString('hello world')).toBe('hello world');
      });

      it('should handle empty string', () => {
        expect(sanitizeString('')).toBe('');
      });
    });
  });

  // =========================================================================
  // sanitizeInput() Tests
  // =========================================================================
  describe('sanitizeInput()', () => {
    
    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should sanitize and trim', () => {
      expect(sanitizeInput('  <script>  ')).toBe('&lt;script&gt;');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeInput(123 as any)).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput({} as any)).toBe('');
    });

    it('should respect custom max length', () => {
      const result = sanitizeInput('hello world', 5);
      expect(result).toBe('hello');
    });

    it('should use default max length of 1000', () => {
      const longString = 'a'.repeat(1500);
      const result = sanitizeInput(longString);
      expect(result.length).toBe(1000);
    });

    it('should handle strings with only whitespace', () => {
      expect(sanitizeInput('   ')).toBe('');
    });
  });
});
