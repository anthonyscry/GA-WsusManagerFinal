/**
 * Security Utilities
 * Functions for secure operations
 */

/**
 * Generate secure random ID
 */
export function generateSecureId(length: number = 11): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(36)).join('').slice(0, length);
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(input: string, maxLength: number = 10000): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, maxLength);
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  return sanitizeString(input, maxLength).trim();
}
