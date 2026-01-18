/**
 * State service utility functions
 */

/**
 * Generate secure random ID using crypto API
 */
export function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(36)).join('').slice(0, 11);
}

/**
 * Validate hostname for security
 */
export function validateHostname(hostname: string | undefined): string | null {
  if (!hostname) return null;
  // Whitelist approach - only allow safe characters
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) return null;
  if (hostname.length > 255) return null;
  return hostname;
}
