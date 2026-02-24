import { z } from 'zod';

// These schemas validate capability key formats and are NOT auto-generated.
// They should continue to be imported from here.

/**
 * Validates root capability keys (base62, 22+ characters).
 * Example: `AbCdEfGhIjKlMnOpQrStUv`
 *
 * @example
 * ```typescript
 * import { rootCapabilityKeySchema } from '@mdplane/shared';
 * rootCapabilityKeySchema.parse('AbCdEfGhIjKlMnOpQrStUv'); // OK
 * ```
 */
export const rootCapabilityKeySchema = z.string().regex(/^[A-Za-z0-9]{22,}$/);

/**
 * Validates scoped capability keys (prefixed with r_/a_/w_).
 * Example: `r_AbCdEfGhIjKlMnOpQrSt`
 *
 * @example
 * ```typescript
 * import { scopedKeySchema } from '@mdplane/shared';
 * scopedKeySchema.parse('r_AbCdEfGhIjKlMnOpQrSt'); // OK
 * scopedKeySchema.parse('a_AbCdEfGhIjKlMnOpQrSt'); // OK
 * scopedKeySchema.parse('w_AbCdEfGhIjKlMnOpQrSt'); // OK
 * ```
 */
export const scopedKeySchema = z.string().regex(/^(r|a|w)_[A-Za-z0-9]{20,}$/);

/**
 * Validates API keys (prefixed with sk_live_ or sk_test_).
 * Example: `sk_live_AbCdEfGhIjKlMnOpQrSt`
 *
 * @example
 * ```typescript
 * import { apiKeySchema } from '@mdplane/shared';
 * apiKeySchema.parse('sk_live_AbCdEfGhIjKlMnOpQrSt'); // OK
 * apiKeySchema.parse('sk_test_AbCdEfGhIjKlMnOpQrSt'); // OK
 * ```
 */
export const apiKeySchema = z.string().regex(/^sk_(live|test)_[A-Za-z0-9]{20,}$/);

