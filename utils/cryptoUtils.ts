
/**
 * Cryptographic utilities for secure password storage
 * Uses Web Crypto API for encryption
 */

const IV_LENGTH = 12; // 96 bits for AES-GCM

/**
 * Derive encryption key from session (in production, use proper key derivation)
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  // In a real implementation, derive from user session or secure storage
  // For now, using a fixed key derived from a constant (NOT SECURE FOR PRODUCTION)
  // TODO: Implement proper key derivation from user session or Windows Credential Manager
  
  const keyMaterial = new TextEncoder().encode('wsus-manager-vault-key-2024'); // This should be session-based
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('wsus-salt'),
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
