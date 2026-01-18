/**
 * Cryptographic utilities for secure password storage
 * Uses Web Crypto API for encryption
 * 
 * SECURITY NOTE: This implementation uses session-based key derivation.
 * The encryption key is derived from a combination of:
 * 1. A machine-specific identifier (from sessionStorage)
 * 2. The current session timestamp
 * 
 * For production environments requiring persistent credentials:
 * - Consider using Windows Credential Manager via PowerShell
 * - Or implement Electron's safeStorage API
 * 
 * Current approach is suitable for session-only credential storage
 * where credentials are cleared on app restart.
 */

const IV_LENGTH = 12; // 96 bits for AES-GCM
const SESSION_KEY_NAME = 'wsus_session_key';

/**
 * Get or create a session-specific key material
 * This ensures each session has a unique encryption context
 */
function getSessionKeyMaterial(): string {
  let sessionKey = sessionStorage.getItem(SESSION_KEY_NAME);
  
  if (!sessionKey) {
    // Generate a random session key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    sessionKey = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(SESSION_KEY_NAME, sessionKey);
  }
  
  return sessionKey;
}

/**
 * Derive encryption key from session-specific material
 * Key is unique per session and cleared on app restart
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const sessionKey = getSessionKeyMaterial();
  const keyMaterial = new TextEncoder().encode(sessionKey);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // Use session key as salt for additional uniqueness
  const salt = new TextEncoder().encode(sessionKey.substring(0, 16));
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt password using AES-GCM
 * Returns base64-encoded ciphertext with IV prepended
 */
export async function encryptPassword(password: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv, 0);
    combined.set(encryptedArray, iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt password');
  }
}

/**
 * Decrypt password using AES-GCM
 * Returns null if decryption fails (e.g., different session)
 */
export async function decryptPassword(encryptedData: string): Promise<string | null> {
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    // Decryption fails if session key changed (app restart)
    // This is expected behavior - credentials are session-only
    console.warn('Decryption failed - credentials may be from a different session');
    return null;
  }
}

/**
 * Clear encrypted password from storage
 */
export function clearEncryptedPassword(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Failed to clear password:', error);
  }
}

/**
 * Clear all session credentials
 * Call this on logout or when user wants to clear stored credentials
 */
export function clearSessionCredentials(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY_NAME);
  } catch (error) {
    console.error('Failed to clear session credentials:', error);
  }
}
