/**
 * Validation Utilities
 * Reusable validation functions
 */

/**
 * Validate hostname format
 */
export function validateHostname(hostname: string | undefined | null): string | null {
  if (!hostname || typeof hostname !== 'string') return null;
  
  // Whitelist approach - only allow safe characters
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) return null;
  if (hostname.length > 255) return null;
  if (hostname.length === 0) return null;
  
  return hostname;
}

/**
 * Validate command input
 */
export function validateCommandInput(input: string, maxLength: number = 1000): boolean {
  if (typeof input !== 'string') return false;
  if (input.length > maxLength) return false;
  if (input.trim().length === 0) return false;
  return true;
}

/**
 * Validate ID format
 */
export function validateId(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 100) return false;
  if (id.trim().length === 0) return false;
  return true;
}

/**
 * Validate time format (HH:MM)
 */
export function validateTime(time: string): boolean {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}
