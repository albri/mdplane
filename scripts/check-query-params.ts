#!/usr/bin/env bun
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

const PATHS_DIR = join(import.meta.dir, '../packages/shared/openapi/paths');
const QUERY_SCHEMAS_PATH = join(import.meta.dir, '../packages/shared/src/generated/query-schemas.gen.ts');

console.log('🔍 Checking query parameter coverage...\n');

type UnknownRecord = Record<string, unknown>;

type OpenApiParameter = {
  in?: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toQueryParameters(value: unknown): OpenApiParameter[] {
  if (!Array.isArray(value)) return [];
  return value.filter((param): param is OpenApiParameter => {
    return isRecord(param) && param.in === 'query';
  });
}

const querySchemas = readFileSync(QUERY_SCHEMAS_PATH, 'utf-8');

let failed = false;
let checked = 0;
let covered = 0;

const pathFiles = readdirSync(PATHS_DIR).filter(f => f.endsWith('.yaml'));

for (const file of pathFiles) {
  const parsed = YAML.parse(readFileSync(join(PATHS_DIR, file), 'utf-8'));
  if (!isRecord(parsed)) continue;

  for (const [path, methods] of Object.entries(parsed)) {
    if (!isRecord(methods)) continue;

    for (const [method, operationValue] of Object.entries(methods)) {
      if (!isRecord(operationValue)) continue;

      const operationId = operationValue.operationId;
      if (typeof operationId !== 'string' || operationId.length === 0) continue;

      const params = toQueryParameters(operationValue.parameters);
      if (params.length === 0) continue;

      checked++;

      const schemaName = `z${operationId.charAt(0).toUpperCase()}${operationId.slice(1)}Query`;

      if (querySchemas.includes(`export const ${schemaName}`)) {
        covered++;
        console.log(`✅ ${method.toUpperCase()} ${path} → ${schemaName}`);
      } else {
        failed = true;
        console.log(`❌ ${method.toUpperCase()} ${path} → Missing ${schemaName}`);
      }
    }
  }
}

console.log(`\n📊 Coverage: ${covered}/${checked} endpoints with query params have schemas`);

if (failed) {
  console.log('\n❌ Query parameter coverage check FAILED');
  console.log('Run: pnpm --filter @mdplane/shared generate:query-schemas');
  process.exit(1);
}

console.log('\n✅ All query parameters have Zod schemas');
process.exit(0);

