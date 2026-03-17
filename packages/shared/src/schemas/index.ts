import { z } from 'zod';

// Handwritten key validators that are not generated from OpenAPI.
export const rootCapabilityKeySchema = z.string().regex(/^[A-Za-z0-9]{22,}$/);
export const scopedKeySchema = z.string().regex(/^(r|a|w)_[A-Za-z0-9]{20,}$/);
export const apiKeySchema = z.string().regex(/^sk_(live|test)_[A-Za-z0-9]{20,}$/);
