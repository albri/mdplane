import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';
import type { ChangelogData } from './types';

export const CHANGELOG: ChangelogData = {
  currentVersion: '1.0.0',
  releasedAt: '2026-01-13T00:00:00Z',
  entries: [
    {
      version: '1.0.0',
      date: '2026-01-13',
      changes: [
        { type: 'added', description: 'Initial API release' },
        { type: 'added', description: 'OAuth authentication (GitHub, Google)' },
        { type: 'added', description: 'Capability URLs for zero-friction access' },
        { type: 'added', description: 'Task management with claims and heartbeats' },
        { type: 'added', description: 'Real-time WebSocket subscriptions' },
        { type: 'added', description: 'Orchestration views for control surfaces' },
        { type: 'added', description: 'Webhook delivery with SSRF protection' },
        { type: 'added', description: 'Full-text search with trigram matching' },
        { type: 'added', description: 'Audit log for all file operations' },
        { type: 'added', description: 'Export functionality (JSON, ZIP)' },
      ],
    },
  ],
};

function findOpenApiSpecPath(): string | null {
  const envPath = process.env.OPENAPI_SPEC_PATH?.trim();
  if (envPath) {
    const explicit = resolve(envPath);
    if (existsSync(explicit)) {
      return explicit;
    }
  }

  const relativeCandidates = [
    'openapi.bundled.yaml',
    'openapi/openapi.yaml',
    'openapi/openapi.bundled.yaml',
    'packages/shared/openapi.bundled.yaml',
  ];

  const startDirs: string[] = [];
  if (typeof import.meta.dir === 'string' && import.meta.dir.length > 0) {
    startDirs.push(import.meta.dir);
  }
  if (typeof __dirname === 'string' && __dirname.length > 0) {
    startDirs.push(__dirname);
  }
  startDirs.push(process.cwd());

  for (const startDir of startDirs) {
    let cursor = startDir;
    for (let i = 0; i < 10; i += 1) {
      for (const relativePath of relativeCandidates) {
        const candidate = resolve(cursor, relativePath);
        if (existsSync(candidate)) {
          return candidate;
        }
      }
      const parent = resolve(cursor, '..');
      if (parent === cursor) {
        break;
      }
      cursor = parent;
    }
  }

  return null;
}

let cachedOpenApiSpec: unknown = null;

export function getOpenApiSpec(): unknown {
  if (cachedOpenApiSpec) {
    return cachedOpenApiSpec;
  }
  try {
    const specPath = findOpenApiSpecPath();
    if (!specPath) {
      return null;
    }
    const yamlContent = readFileSync(specPath, 'utf8');
    cachedOpenApiSpec = yaml.load(yamlContent);
    return cachedOpenApiSpec;
  } catch {
    return null;
  }
}

export const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>mdplane API Documentation</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>`;
