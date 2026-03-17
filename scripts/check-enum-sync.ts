#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

interface EnumMapping {
  name: string;
  drizzleTable: string;
  drizzleColumn: string;
  openApiFile: string;
  openApiSchema: string;
}

const ENUM_MAPPINGS: EnumMapping[] = [
  {
    name: 'AppendStatus',
    drizzleTable: 'appends',
    drizzleColumn: 'status',
    openApiFile: 'appends.yaml',
    openApiSchema: 'AppendStatus',
  },
  {
    name: 'Priority',
    drizzleTable: 'appends',
    drizzleColumn: 'priority',
    openApiFile: 'appends.yaml',
    openApiSchema: 'Priority',
  },
  {
    name: 'HeartbeatStatus',
    drizzleTable: 'heartbeats',
    drizzleColumn: 'status',
    openApiFile: 'realtime.yaml',
    openApiSchema: 'HeartbeatStatus',
  },
  {
    name: 'JobStatus',
    drizzleTable: 'jobs',
    drizzleColumn: 'status',
    openApiFile: 'jobs.yaml',
    openApiSchema: 'JobStatus',
  },
  {
    name: 'ExportFormat',
    drizzleTable: 'exportJobs',
    drizzleColumn: 'format',
    openApiFile: 'jobs.yaml',
    openApiSchema: 'ExportFormat',
  },
  {
    name: 'KeyPermission',
    drizzleTable: 'capabilityKeys',
    drizzleColumn: 'permission',
    openApiFile: 'keys.yaml',
    openApiSchema: 'KeyPermission',
  },
];

function extractTableDefinition(schemaContent: string, tableName: string): string | null {
  const startPattern = new RegExp(`export const ${tableName}\\s*=\\s*sqliteTable\\(`);
  const startMatch = schemaContent.match(startPattern);

  if (!startMatch || startMatch.index === undefined) return null;

  const startIndex = startMatch.index;
  let depth = 0;
  let inTable = false;
  let endIndex = startIndex;

  for (let i = startIndex; i < schemaContent.length; i++) {
    const char = schemaContent[i];
    if (char === '(') {
      depth++;
      inTable = true;
    } else if (char === ')') {
      depth--;
      if (inTable && depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  return schemaContent.substring(startIndex, endIndex);
}

function extractColumnEnum(tableContent: string, columnName: string): string[] | null {
  const columnPattern = new RegExp(
    `${columnName}:\\s*text\\([^)]*\\{\\s*enum:\\s*\\[([^\\]]+)\\]`,
    's'
  );
  const match = tableContent.match(columnPattern);

  if (match && match[1]) {
    return match[1]
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''))
      .filter(v => v.length > 0);
  }

  return null;
}

function extractDrizzleEnum(schemaContent: string, mapping: EnumMapping): string[] | null {
  const tableContent = extractTableDefinition(schemaContent, mapping.drizzleTable);
  if (!tableContent) return null;

  return extractColumnEnum(tableContent, mapping.drizzleColumn);
}

function parseOpenApiEnum(schemasDir: string, file: string, schemaName: string): string[] | null {
  const filePath = join(schemasDir, file);
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseYaml(content);

    const schema = parsed[schemaName];
    if (schema && schema.enum) {
      return schema.enum.map((v: unknown) => String(v));
    }
    return null;
  } catch {
    return null;
  }
}

const ROOT = join(import.meta.dir, '..');
const SCHEMA_PATH = join(ROOT, 'apps/server/src/db/schema.ts');
const OPENAPI_SCHEMAS_DIR = join(ROOT, 'packages/shared/openapi/components/schemas');

console.log('🔍 Checking enum sync between Drizzle schema and OpenAPI spec...\n');

const schemaContent = readFileSync(SCHEMA_PATH, 'utf-8');

let hasErrors = false;
const results: { name: string; status: 'ok' | 'mismatch' | 'missing'; details?: string }[] = [];

for (const mapping of ENUM_MAPPINGS) {
  const drizzleValues = extractDrizzleEnum(schemaContent, mapping);
  const openApiValues = parseOpenApiEnum(OPENAPI_SCHEMAS_DIR, mapping.openApiFile, mapping.openApiSchema);

  if (!drizzleValues) {
    results.push({ name: mapping.name, status: 'missing', details: 'Could not find enum in Drizzle schema' });
    hasErrors = true;
    continue;
  }

  if (!openApiValues) {
    results.push({ name: mapping.name, status: 'missing', details: 'Could not find enum in OpenAPI spec' });
    hasErrors = true;
    continue;
  }

  const drizzleSorted = [...drizzleValues].sort();
  const openApiSorted = [...openApiValues].sort();

  const drizzleSet = new Set(drizzleSorted);
  const openApiSet = new Set(openApiSorted);

  const missingInOpenApi = drizzleSorted.filter(v => !openApiSet.has(v));
  const extraInOpenApi = openApiSorted.filter(v => !drizzleSet.has(v));

  if (missingInOpenApi.length > 0) {
    results.push({
      name: mapping.name,
      status: 'mismatch',
      details: `DB has values not in OpenAPI: [${missingInOpenApi.join(', ')}]`,
    });
    hasErrors = true;
  } else if (extraInOpenApi.length > 0) {
    results.push({
      name: mapping.name,
      status: 'ok',
      details: `OpenAPI has extra values (computed): [${extraInOpenApi.join(', ')}]`,
    });
  } else {
    results.push({ name: mapping.name, status: 'ok' });
  }
}

for (const result of results) {
  const icon = result.status === 'ok' ? '✅' : result.status === 'mismatch' ? '❌' : '⚠️';
  const statusText = result.status === 'ok' ? 'OK' : result.status === 'mismatch' ? 'MISMATCH' : 'MISSING';
  console.log(`${icon} ${result.name}: ${statusText}${result.details ? ` - ${result.details}` : ''}`);
}

console.log('');

if (hasErrors) {
  console.log('❌ Enum sync check FAILED. Please update the Drizzle schema or OpenAPI spec to match.');
  process.exit(1);
} else {
  console.log('✅ All enums are in sync!');
  process.exit(0);
}

