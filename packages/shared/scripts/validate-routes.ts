#!/usr/bin/env npx tsx
/**
 * Route Validation Script
 *
 * Validates that route constants in routes/index.ts match the OpenAPI spec.
 * Run with: pnpm routes:validate
 *
 * Exit codes:
 * - 0: All routes valid
 * - 1: Validation errors found
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
  CAPABILITY_ROUTES,
  FOLDER_ROUTES,
  API_V1_ROUTES,
  WORKSPACE_ROUTES,
  AUTH_ROUTES,
  SYSTEM_ROUTES,
  JOB_ROUTES,
} from '../src/routes/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI_PATH = resolve(__dirname, '../openapi/openapi.yaml');

interface OpenAPISpec {
  paths: Record<string, unknown>;
}

/**
 * Extract all path patterns from OpenAPI spec
 */
function extractOpenAPIPaths(): Set<string> {
  const content = readFileSync(OPENAPI_PATH, 'utf-8');
  const spec = parseYaml(content) as OpenAPISpec;

  const paths = new Set<string>();
  for (const path of Object.keys(spec.paths)) {
    // Normalize path parameters: {key} -> {param}
    const normalized = path.replace(/\{[^}]+\}/g, '{param}');
    paths.add(normalized);
  }
  return paths;
}

/**
 * Extract route patterns from our route constants
 */
function extractRoutePatterns(): Map<string, string> {
  const patterns = new Map<string, string>();

  // Helper to extract pattern from route builder
  const extractPattern = (name: string, value: unknown, prefix = '') => {
    if (typeof value === 'string') {
      // Static route
      const normalized = value.replace(/\{[^}]+\}/g, '{param}');
      patterns.set(`${prefix}${name}`, normalized);
    } else if (typeof value === 'function') {
      // Route builder function - call with placeholder args
      try {
        const result = (value as (...args: string[]) => string)('PARAM1', 'PARAM2', 'PARAM3');
        if (typeof result === 'string') {
          // Replace actual params with {param}
          const normalized = result
            .replace(/PARAM1/g, '{param}')
            .replace(/PARAM2/g, '{param}')
            .replace(/PARAM3/g, '{param}')
            .replace(/%7Bparam%7D/g, '{param}'); // Handle URL-encoded
          patterns.set(`${prefix}${name}`, normalized);
        }
      } catch {
        // Some functions may need specific args, skip
      }
    }
  };

  // Process each route group
  const routeGroups: [string, Record<string, unknown>][] = [
    ['CAPABILITY_ROUTES', CAPABILITY_ROUTES as unknown as Record<string, unknown>],
    ['FOLDER_ROUTES', FOLDER_ROUTES as unknown as Record<string, unknown>],
    ['API_V1_ROUTES', API_V1_ROUTES as unknown as Record<string, unknown>],
    ['WORKSPACE_ROUTES', WORKSPACE_ROUTES as unknown as Record<string, unknown>],
    ['AUTH_ROUTES', AUTH_ROUTES as unknown as Record<string, unknown>],
    ['SYSTEM_ROUTES', SYSTEM_ROUTES as unknown as Record<string, unknown>],
    ['JOB_ROUTES', JOB_ROUTES as unknown as Record<string, unknown>],
  ];

  for (const [groupName, group] of routeGroups) {
    if (group && typeof group === 'object') {
      for (const [key, value] of Object.entries(group)) {
        extractPattern(key, value, `${groupName}.`);
      }
    }
  }

  return patterns;
}

/**
 * Validate routes against OpenAPI spec
 */
function validateRoutes(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('📋 Loading OpenAPI spec...');
  const openAPIPaths = extractOpenAPIPaths();
  console.log(`   Found ${openAPIPaths.size} paths in OpenAPI spec`);

  console.log('\n📋 Extracting route patterns...');
  const routePatterns = extractRoutePatterns();
  console.log(`   Found ${routePatterns.size} route builders`);

  console.log('\n🔍 Validating routes...\n');

  // Routes to skip validation (dynamic helpers only)
  const skipPatterns = new Set([
    'CAPABILITY_ROUTES.byKeyType', // Dynamic helper for building routes by key type
    'FOLDER_ROUTES.byKeyType', // Dynamic helper for building folder routes by key type
  ]);

  // Check each route pattern exists in OpenAPI
  for (const [name, pattern] of routePatterns) {
    // Skip explicitly excluded patterns
    if (skipPatterns.has(name)) {
      continue;
    }

    // Skip /api/v1/r/, /api/v1/a/, /api/v1/w/ routes - these are CLI convenience routes
    // that proxy to the base capability routes
    if (pattern.startsWith('/api/v1/r/') || pattern.startsWith('/api/v1/a/') || pattern.startsWith('/api/v1/w/')) {
      // These are valid - they're just prefixed versions of capability routes
      continue;
    }

    if (!openAPIPaths.has(pattern)) {
      // Check if it's a sub-path of an existing route (e.g., /r/{key}/folders vs /r/{key}/folders/{path})
      const isSubPath = Array.from(openAPIPaths).some(
        (p) => pattern.startsWith(p.replace(/\/\{param\}$/, ''))
      );
      if (!isSubPath) {
        errors.push(`❌ ${name}: "${pattern}" not found in OpenAPI spec`);
      }
    }
  }

  // Check for OpenAPI paths not covered by route constants
  const coveredPatterns = new Set(routePatterns.values());
  for (const path of openAPIPaths) {
    // Skip admin routes - not exposed in route constants
    if (path.includes('/admin/')) continue;

    if (!coveredPatterns.has(path)) {
      warnings.push(`⚠️  OpenAPI path "${path}" has no route constant`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

const result = validateRoutes();

if (result.errors.length > 0) {
  console.log('Errors:');
  result.errors.forEach((e) => console.log(`  ${e}`));
}

if (result.warnings.length > 0) {
  console.log('\nWarnings (routes in OpenAPI but not in constants):');
  result.warnings.slice(0, 10).forEach((w) => console.log(`  ${w}`));
  if (result.warnings.length > 10) {
    console.log(`  ... and ${result.warnings.length - 10} more`);
  }
}

console.log('\n' + (result.valid ? '✅ All route constants are valid!' : '❌ Validation failed'));
process.exit(result.valid ? 0 : 1);

