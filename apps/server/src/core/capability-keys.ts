export type Permission = 'read' | 'append' | 'write';
export type ApiKeyMode = 'live' | 'test';
export type KeyType = 'root' | 'scoped' | 'api';

export const BASE62_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const KEY_PATTERNS = {
  rootCapability: /^[A-Za-z0-9]{22,}$/,
  scopedKey: /^(r|a|w)_[A-Za-z0-9]{20,}$/,
  apiKey: /^sk_(live|test)_[A-Za-z0-9]{20,}$/,
} as const;

const MIN_KEY_LENGTH = 22;

const PERMISSION_PREFIXES: Record<Permission, string> = {
  read: 'r_',
  append: 'a_',
  write: 'w_',
};

/**
 * Generate a cryptographically secure random key using base62 alphabet.
 *
 * @param length - Optional minimum length (default: 22, minimum enforced: 22)
 * @returns A random base62 string of the specified length
 */
export function generateKey(length?: number): string {
  // Enforce minimum length of 22
  const actualLength = Math.max(length ?? MIN_KEY_LENGTH, MIN_KEY_LENGTH);

  // Use CSPRNG to generate random bytes
  const randomBytes = new Uint8Array(actualLength);
  crypto.getRandomValues(randomBytes);

  // Convert to base62 characters
  let result = '';
  for (let i = 0; i < actualLength; i++) {
    // Use modulo to select from the 62-character alphabet
    // Note: This has slight bias but is acceptable for this use case
    result += BASE62_ALPHABET[randomBytes[i] % BASE62_ALPHABET.length];
  }

  return result;
}

/**
 * Generate a scoped capability key with permission prefix.
 *
 * @param permission - The permission level: 'read', 'append', or 'write'
 * @returns A scoped key like 'r_xxx...', 'a_xxx...', or 'w_xxx...'
 */
export function generateScopedKey(permission: Permission): string {
  const prefix = PERMISSION_PREFIXES[permission];

  if (!prefix) {
    throw new Error(`Invalid permission type: ${permission}`);
  }

  // Generate 20 base62 characters for the suffix (prefix is 2 chars, total >= 22)
  const suffix = generateKey(20);

  return `${prefix}${suffix}`;
}

/**
 * Generate an API key with mode prefix.
 *
 * @param mode - The API key mode: 'live' or 'test'
 * @returns An API key like 'sk_live_xxx...' or 'sk_test_xxx...'
 */
export function generateApiKey(mode: ApiKeyMode): string {
  if (mode !== 'live' && mode !== 'test') {
    throw new Error(`Invalid API key mode: ${mode}`);
  }

  const prefix = mode === 'live' ? 'sk_live_' : 'sk_test_';
  // Generate 20 base62 characters for the suffix
  const suffix = generateKey(20);

  return `${prefix}${suffix}`;
}

/**
 * Validate a key against the expected pattern.
 *
 * @param key - The key to validate
 * @param type - The type of key: 'root', 'scoped', or 'api'
 * @returns true if valid, false if invalid
 */
export function validateKey(key: string, type: KeyType): boolean {
  // Handle empty string
  if (key === '') {
    return false;
  }

  switch (type) {
    case 'root':
      return KEY_PATTERNS.rootCapability.test(key);
    case 'scoped':
      return KEY_PATTERNS.scopedKey.test(key);
    case 'api':
      return KEY_PATTERNS.apiKey.test(key);
    default:
      throw new Error(`Invalid key type: ${type}`);
  }
}

/**
 * Compare two strings using constant-time comparison to prevent timing attacks.
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
export function secureCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  // If lengths differ, still compare all bytes to maintain constant time
  // We compare against the longer array length
  const maxLength = Math.max(aBytes.length, bBytes.length);

  let result = aBytes.length === bBytes.length ? 0 : 1;

  // Compare byte-by-byte using bitwise OR to accumulate differences
  for (let i = 0; i < maxLength; i++) {
    const aByte = i < aBytes.length ? aBytes[i] : 0;
    const bByte = i < bBytes.length ? bBytes[i] : 0;
    result |= aByte ^ bByte;
  }

  return result === 0;
}

/**
 * Hash a key for secure storage.
 *
 * Uses SHA-256 to produce a one-way hash suitable for database storage.
 * The original key cannot be recovered from the hash.
 *
 * @param key - The key to hash
 * @returns A 64-character hexadecimal hash string
 */
export function hashKey(key: string): string {
  // Use Bun's native crypto for synchronous SHA-256 hashing
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(key);
  return hasher.digest('hex');
}

