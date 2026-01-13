
/**
 * Cryptographic utilities for secure password storage
 * Uses Web Crypto API for encryption with session-specific key derivation
 *
 * Security improvements:
 * - Random salt per installation (stored securely)
 * - Session-unique key material
 * - OWASP-compliant iteration count
 * - Random IV per encryption operation
 */

const VAULT_SALT_KEY = 'wsus_vault_salt';
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 32; // 256-bit salt per OWASP
const ITERATIONS = 600000; // OWASP 2023 recommendation for PBKDF2-SHA256

// Session-unique component: derived from machine-specific entropy on first use
let sessionKeyMaterial: Uint8Array | null = null;

/**
 * Get or generate installation-specific salt (stored in localStorage)
 * This ensures each installation has unique encryption parameters
 */
function getOrCreateInstallationSalt(): Uint8Array {
  try {
    const storedSalt = localStorage.getItem(VAULT_SALT_KEY);
    if (storedSalt) {
      return Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
    }
  } catch {
    // localStorage unavailable, generate new salt
  }

  // Generate cryptographically secure random salt
  const newSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  try {
    localStorage.setItem(VAULT_SALT_KEY, btoa(String.fromCharCode(...newSalt)));
  } catch {
    // If storage fails, salt will be regenerated next session (data loss acceptable for security)
  }
  return newSalt;
}

/**
 * Generate session-specific key material using available entropy sources
 * Combines: timestamp, random bytes, user-agent, and screen info
 */
function getSessionKeyMaterial(): Uint8Array {
  if (sessionKeyMaterial) {
    return sessionKeyMaterial;
  }

  // Gather entropy from multiple sources
  const entropyParts: string[] = [
    Date.now().toString(36),
    Math.random().toString(36),
    typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'electron',
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '1920x1080',
    crypto.getRandomValues(new Uint8Array(16)).join('')
  ];

  const entropyString = entropyParts.join('|');
  sessionKeyMaterial = new TextEncoder().encode(entropyString);
  return sessionKeyMaterial;
}

/**
 * Derive encryption key using PBKDF2 with:
 * - Session-specific key material (changes per app launch)
 * - Installation-specific salt (persistent per machine)
 * - OWASP-compliant iterations
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = getSessionKeyMaterial();
  const salt = getOrCreateInstallationSalt();

  // TypeScript 5.7+ requires explicit ArrayBuffer for crypto APIs
  // Create a fresh ArrayBuffer from the Uint8Array to satisfy type constraints
  const keyBuffer = new Uint8Array(keyMaterial).buffer;
  const saltBuffer = new Uint8Array(salt).buffer;

  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt password using AES-GCM
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
    
    // Store IV and encrypted data as base64
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
    console.error('Decryption failed:', error);
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
