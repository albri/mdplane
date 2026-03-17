/**
 * OpenAPI Schema Validator
 *
 * Validates API responses against generated Zod schemas from the OpenAPI spec.
 * Uses the schemas from @mdplane/shared/src/generated/client/zod.gen.ts.
 *
 * @example
 * ```typescript
 * import { validateResponse, assertValidResponse } from '../helpers/schema-validator';
 *
 * // Validate and get result
 * const result = validateResponse(data, 'BootstrapResponse');
 * if (!result.success) {
 *   console.error(result.error);
 * }
 *
 * // Assert valid (throws on failure)
 * assertValidResponse(data, 'AppendResponse');
 * ```
 */

import { ZodError, ZodSchema } from 'zod';

// Import all generated Zod schemas from @mdplane/shared
// The schemas are re-exported from the package root
import * as generatedSchemas from '@mdplane/shared';

/**
 * Map of schema names (without 'z' prefix) to their Zod schemas.
 * This allows looking up schemas by their OpenAPI component name.
 */
const schemaRegistry: Record<string, ZodSchema> = {};

// Build the registry by extracting schema names from exports
// Generated schemas are prefixed with 'z', e.g., 'zBootstrapResponse'
for (const [key, value] of Object.entries(generatedSchemas)) {
  if (key.startsWith('z') && key.length > 1) {
    // Remove 'z' prefix to get the schema name (e.g., 'BootstrapResponse')
    const schemaName = key.slice(1);
    if (typeof value === 'object' && value !== null && 'parse' in value) {
      schemaRegistry[schemaName] = value as ZodSchema;
    }
  }
}

/**
 * Result of schema validation.
 */
export type ValidationResult =
  | { success: true; data: unknown }
  | { success: false; error: ZodError; message: string };

/**
 * Get a schema by name from the registry.
 *
 * @param schemaName - The name of the schema (e.g., 'BootstrapResponse', 'AppendResponse')
 * @returns The Zod schema, or undefined if not found
 */
export function getSchema(schemaName: string): ZodSchema | undefined {
  return schemaRegistry[schemaName];
}

/**
 * Get all available schema names.
 *
 * @returns Array of schema names that can be used with validateResponse
 */
export function getSchemaNames(): string[] {
  return Object.keys(schemaRegistry).sort();
}

/**
 * Validate data against a named OpenAPI schema.
 *
 * @param data - The data to validate
 * @param schemaName - The name of the schema (e.g., 'BootstrapResponse', 'AppendResponse')
 * @returns Validation result with success/failure and parsed data or error details
 *
 * @example
 * ```typescript
 * const response = await app.handle(request);
 * const data = await response.json();
 * const result = validateResponse(data, 'BootstrapResponse');
 *
 * if (result.success) {
 *   console.log('Valid:', result.data);
 * } else {
 *   console.error('Invalid:', result.message);
 * }
 * ```
 */
export function validateResponse(
  data: unknown,
  schemaName: string
): ValidationResult {
  const schema = schemaRegistry[schemaName];

  if (!schema) {
    const available = Object.keys(schemaRegistry).slice(0, 10).join(', ');
    throw new Error(
      `Unknown schema: "${schemaName}". ` +
        `Available schemas include: ${available}... ` +
        `(${Object.keys(schemaRegistry).length} total)`
    );
  }

  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error message for readability
  const issues = result.error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return `  - ${path ? `${path}: ` : ''}${issue.message}`;
    })
    .join('\n');

  const message =
    `Response does not match schema "${schemaName}":\n${issues}\n\n` +
    `Received: ${JSON.stringify(data, null, 2).slice(0, 500)}`;

  return { success: false, error: result.error, message };
}

/**
 * Assert that data matches a named OpenAPI schema.
 * Throws an error with detailed message if validation fails.
 *
 * @param data - The data to validate
 * @param schemaName - The name of the schema (e.g., 'BootstrapResponse', 'AppendResponse')
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const response = await app.handle(request);
 * const data = await response.json();
 * assertValidResponse(data, 'BootstrapResponse'); // Throws if invalid
 * ```
 */
export function assertValidResponse(data: unknown, schemaName: string): void {
  const result = validateResponse(data, schemaName);
  if (!result.success) {
    throw new Error(result.message);
  }
}

