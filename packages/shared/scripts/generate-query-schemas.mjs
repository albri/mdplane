#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'yaml';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const HEADER = `import { z } from 'zod';

`;

function buildZodType(param) {
  const schema = param.schema;
  let zodType;

  if (!schema) {
    zodType = 'z.string()';
  } else if (schema.type === 'integer') {
    zodType = 'z.coerce.number().int()';
    if (schema.minimum !== undefined) zodType += `.gte(${schema.minimum})`;
    if (schema.maximum !== undefined) zodType += `.lte(${schema.maximum})`;
  } else if (schema.type === 'number') {
    zodType = 'z.coerce.number()';
    if (schema.minimum !== undefined) zodType += `.gte(${schema.minimum})`;
    if (schema.maximum !== undefined) zodType += `.lte(${schema.maximum})`;
  } else if (schema.type === 'boolean') {
    zodType = "z.enum(['true', 'false'])";
  } else if (schema.type === 'string' && schema.enum) {
    const enumValues = schema.enum.map((value) => `'${value}'`).join(', ');
    zodType = `z.enum([${enumValues}])`;
  } else {
    zodType = 'z.string()';
    if (schema.maxLength !== undefined) zodType += `.max(${schema.maxLength})`;
    if (schema.minLength !== undefined) zodType += `.min(${schema.minLength})`;
  }

  if (!param.required) {
    zodType += '.optional()';
  }

  if (schema?.default !== undefined) {
    const defaultValue = schema.type === 'boolean'
      ? String(schema.default)
      : schema.default;
    zodType += `.default(${JSON.stringify(defaultValue)})`;
  }

  return zodType;
}

function generateSchemaName(operationId) {
  const pascal = operationId
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
  return `z${pascal}Query`;
}

function sanitizeDescription(description) {
  return description.replace(/\s+/g, ' ').trim();
}

function generateZodSchema(parameters) {
  const fields = parameters.map((param) => {
    const zodType = buildZodType(param);
    const comment = param.description
      ? `  // ${sanitizeDescription(param.description)}\n`
      : '';
    return `${comment}  ${param.name}: ${zodType}`;
  });

  return `z.object({\n${fields.join(',\n')}\n})`;
}

function isRefParameter(parameter) {
  return '$ref' in parameter;
}

function resolveRef(ref, spec) {
  const match = ref.match(/^#\/components\/parameters\/(.+)$/);
  if (!match) return null;

  const parameterName = match[1];
  return spec.components?.parameters?.[parameterName] ?? null;
}

function parseOpenApiQueryParams(spec) {
  const schemas = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = methods[method];
      if (!operation?.parameters) continue;

      const queryParams = [];
      for (const parameter of operation.parameters) {
        let resolved = null;
        if (isRefParameter(parameter)) {
          resolved = resolveRef(parameter.$ref, spec);
        } else {
          resolved = parameter;
        }

        if (resolved && resolved.in === 'query') {
          queryParams.push(resolved);
        }
      }

      if (queryParams.length === 0) continue;

      const operationId = operation.operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const schemaName = generateSchemaName(operationId);
      const typeName = schemaName.replace(/^z/, '');

      schemas.push({
        name: schemaName,
        typeName,
        code: generateZodSchema(queryParams),
        endpoint: `${method.toUpperCase()} ${path}`,
        operationId,
      });
    }
  }

  return schemas;
}

function generateOutputFile(schemas) {
  let output = HEADER;

  for (const schema of schemas) {
    output += `/**\n`;
    output += ` * Query parameters for ${schema.endpoint}\n`;
    output += ` * @operationId ${schema.operationId}\n`;
    output += ` */\n`;
    output += `export const ${schema.name} = ${schema.code};\n\n`;
    output += `export type ${schema.typeName} = z.infer<typeof ${schema.name}>;\n\n`;
  }

  return output;
}

function main() {
  const rootDir = resolve(import.meta.dirname, '..');
  const specPath = join(rootDir, 'openapi.bundled.yaml');
  const outputPath = join(rootDir, 'src', 'generated', 'query-schemas.gen.ts');

  const specContent = readFileSync(specPath, 'utf-8');
  const spec = yaml.parse(specContent);
  const schemas = parseOpenApiQueryParams(spec);
  const output = generateOutputFile(schemas);

  writeFileSync(outputPath, output);

  console.log(`Generated ${schemas.length} query schemas.`);
}

main();
