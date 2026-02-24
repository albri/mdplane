#!/usr/bin/env bun
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import * as yaml from 'js-yaml';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

interface OpenApiSpec {
  paths: Record<string, Record<string, unknown>>;
}

interface RouteInfo {
  method: string;
  path: string;
  file: string;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const EXCLUDED_ROUTE_PATTERNS = [
  /^(get|post|put|patch|delete) \/admin\//,
  /^post \/api\/v1\/admin\/smoke-api-key$/,
  /^ws \/ws$/,
  /^(get|put|delete) \/[raw]\/\/\*$/,
  /^get \/[raw]\/\/folders\/\*$/,
  /\/etc\*?$/,
  /\/etc\/\*$/,
  /^get \/[raw]:key\/folders$/,
  /^post \/a\/:key\/folders\/files$/,
  /^post \/a\/:key\/folders\/copy$/,
  /^post \/a\/:key\/folders\/bulk$/,
  /^post \/w\/:key\/folders\/files$/,
  /^post \/w\/:key\/folders\/move$/,
  /^get \/w\/:key\/folders\/settings$/,
  /^patch \/w\/:key\/folders$/,
  /^patch \/w\/:key\/folders\/settings$/,
  /^delete \/w\/:key\/folders$/,
  /^get \/a\/:key\/folders\/claims$/,
  /^get \/r\/:key\/folders\/(search|tasks|stats)$/,
  /^post \/w\/:key\/folders\/:path\/files$/,
];

const ROUTES_DEFINED_ELSEWHERE: Set<string> = new Set([
  'get /health',
]);

const EXCLUDED_OPENAPI_PATTERNS = [
  /^\/api\/auth\/signin\/(github|google)$/,
  /^\/bulk\/append$/,
];

function parseOpenApiPaths(specPath: string): Map<string, Set<string>> {
  const content = readFileSync(specPath, 'utf8');
  const spec = yaml.load(content) as OpenApiSpec;

  const paths = new Map<string, Set<string>>();

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    const methods = new Set<string>();
    for (const method of HTTP_METHODS) {
      if (pathItem[method]) {
        methods.add(method);
      }
    }
    if (methods.size > 0) {
      paths.set(path, methods);
    }
  }

  return paths;
}

function normalizeOpenApiPath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ':$1');
}

function normalizeElysiaPath(path: string): string {
  let normalized = path.replace(/\/\*\//, '/:path/');
  if (normalized.endsWith('/*')) {
    normalized = normalized.replace(/\/\*$/, '/:path');
  }
  return normalized;
}

function collectRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('__')) {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseRouteFiles(routeDirs: string[]): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const files = routeDirs.flatMap((dir) => collectRouteFiles(dir));

  for (const filePath of files) {
    const file = filePath;
    const content = readFileSync(filePath, 'utf8');

    const routeRegex = /\.(get|post|put|patch|delete|ws)\s*\(\s*['"`](\/[^'"`]*)['"`]/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1];
      const path = match[2];
      routes.push({ method, path, file });
    }
  }

  return routes;
}

function isRouteExcluded(method: string, path: string): boolean {
  const routeKey = `${method} ${path}`;
  return EXCLUDED_ROUTE_PATTERNS.some(pattern => pattern.test(routeKey));
}

function isOpenApiPathExcluded(path: string): boolean {
  return EXCLUDED_OPENAPI_PATTERNS.some(pattern => pattern.test(path));
}

function buildNormalizedPathMap(
  openApiPaths: Map<string, Set<string>>,
  routes: RouteInfo[]
): {
  openApiNormalized: Map<string, { methods: Set<string>; originalPath: string }>;
  routesNormalized: Map<string, { methods: Set<string>; routes: RouteInfo[] }>;
} {
  const openApiNormalized = new Map<string, { methods: Set<string>; originalPath: string }>();
  for (const [path, methods] of openApiPaths) {
    if (isOpenApiPathExcluded(path)) continue;
    const normalized = normalizeOpenApiPath(path);
    openApiNormalized.set(normalized, { methods, originalPath: path });
  }

  const routesNormalized = new Map<string, { methods: Set<string>; routes: RouteInfo[] }>();
  for (const route of routes) {
    if (isRouteExcluded(route.method, route.path)) continue;

    const normalized = normalizeElysiaPath(route.path);
    const existing = routesNormalized.get(normalized);

    if (existing) {
      existing.methods.add(route.method);
      existing.routes.push(route);
    } else {
      routesNormalized.set(normalized, {
        methods: new Set([route.method]),
        routes: [route],
      });
    }
  }

  return { openApiNormalized, routesNormalized };
}

function wildcardMatches(wildcardRoute: string, openApiPath: string): boolean {
  const basePrefix = wildcardRoute.replace(/\/:path$/, '');

  const prefixMatches = openApiPath === basePrefix || openApiPath.startsWith(basePrefix + '/');

  if (!prefixMatches) {
    return false;
  }

  const remainingPath = openApiPath.slice(basePrefix.length);

  const specificEndpoints = [
    '/webhooks',
    '/folders',
    '/search',
    '/tasks',
    '/claims',
    '/stats',
    '/settings',
    '/bulk',
    '/orchestration',
    '/heartbeat',
    '/api-keys',
  ];

  for (const endpoint of specificEndpoints) {
    if (remainingPath.startsWith(endpoint)) {
      return false;
    }
  }

  return true;
}

function findMatchingRoutesWithMethods(
  openApiPath: string,
  routesNormalized: Map<string, { methods: Set<string>; routes: RouteInfo[] }>
): { matchedPath: string | null; aggregatedMethods: Set<string> } {
  const aggregatedMethods = new Set<string>();
  let primaryMatch: string | null = null;

  if (routesNormalized.has(openApiPath)) {
    primaryMatch = openApiPath;
    const routeInfo = routesNormalized.get(openApiPath)!;
    for (const method of routeInfo.methods) {
      aggregatedMethods.add(method);
    }
  }

  for (const [routePath, routeInfo] of routesNormalized) {
    if (routePath.endsWith('/:path')) {
      if (wildcardMatches(routePath, openApiPath)) {
        if (!primaryMatch) primaryMatch = routePath;
        for (const method of routeInfo.methods) {
          aggregatedMethods.add(method);
        }
      }
    }
  }

  return { matchedPath: primaryMatch, aggregatedMethods };
}

function matchWildcardPath(
  openApiPath: string,
  routesNormalized: Map<string, { methods: Set<string>; routes: RouteInfo[] }>
): string | null {
  const { matchedPath } = findMatchingRoutesWithMethods(openApiPath, routesNormalized);
  return matchedPath;
}

function matchOpenApiPath(
  routePath: string,
  openApiNormalized: Map<string, { methods: Set<string>; originalPath: string }>
): string | null {
  if (openApiNormalized.has(routePath)) {
    return routePath;
  }

  const withoutApiPrefix = routePath.replace(/^\/api\/v1/, '');
  if (openApiNormalized.has(withoutApiPrefix)) {
    return withoutApiPrefix;
  }

  const wildcardPatterns = [/\/\*$/, /\/:path$/];
  for (const pattern of wildcardPatterns) {
    if (pattern.test(routePath)) {
      const routePrefix = routePath.replace(pattern, '');
      for (const [openApiPath] of openApiNormalized) {
        if (openApiPath.startsWith(routePrefix + '/') || openApiPath === routePrefix) {
          return openApiPath;
        }
      }
    }
  }

  for (const [openApiPath] of openApiNormalized) {
    if (openApiPath === routePath) {
      return openApiPath;
    }
    if (openApiPath === routePath.replace(/\/:path$/, '')) {
      return openApiPath;
    }
    if (routePath === openApiPath.replace(/\/:path$/, '')) {
      return openApiPath;
    }
    if (openApiPath === withoutApiPrefix.replace(/\/:path$/, '')) {
      return openApiPath;
    }
  }

  return null;
}

function compareRouteCoverage(): { success: boolean; errors: string[] } {
  const workspaceRoot = resolve(import.meta.dir, '..');
  const openApiPath = join(workspaceRoot, 'packages/shared/openapi.bundled.yaml');
  const routesDir = join(workspaceRoot, 'apps/server/src/routes');
  const domainDir = join(workspaceRoot, 'apps/server/src/domain');

  if (!existsSync(openApiPath)) {
    return { success: false, errors: [`OpenAPI spec not found at ${openApiPath}`] };
  }

  if (!existsSync(routesDir)) {
    return { success: false, errors: [`Routes directory not found at ${routesDir}`] };
  }

  if (!existsSync(domainDir)) {
    return { success: false, errors: [`Domain directory not found at ${domainDir}`] };
  }

  console.log(`${colors.blue}Parsing OpenAPI spec...${colors.reset}`);
  const openApiPaths = parseOpenApiPaths(openApiPath);
  console.log(`  Found ${openApiPaths.size} paths in OpenAPI spec`);

  console.log(`${colors.blue}Parsing route files...${colors.reset}`);
  const routes = parseRouteFiles([routesDir, domainDir]);
  console.log(`  Found ${routes.length} route definitions`);

  const { openApiNormalized, routesNormalized } = buildNormalizedPathMap(openApiPaths, routes);
  const errors: string[] = [];

  console.log(`\n${colors.blue}Checking OpenAPI paths for route implementations...${colors.reset}`);
  const openApiMissing: string[] = [];

  for (const [normalizedPath, { methods, originalPath }] of openApiNormalized) {
    const { matchedPath, aggregatedMethods } = findMatchingRoutesWithMethods(normalizedPath, routesNormalized);

    for (const method of methods) {
      const routeKey = `${method} ${normalizedPath}`;
      if (ROUTES_DEFINED_ELSEWHERE.has(routeKey)) {
        continue;
      }

      if (!matchedPath) {
        openApiMissing.push(`${method.toUpperCase()} ${originalPath}`);
      } else {
        if (!aggregatedMethods.has(method)) {
          openApiMissing.push(`${method.toUpperCase()} ${originalPath} (path exists but method missing)`);
        }
      }
    }
  }

  if (openApiMissing.length > 0) {
    console.log(`${colors.red}✗ OpenAPI paths WITHOUT route implementation:${colors.reset}`);
    for (const path of openApiMissing) {
      console.log(`  - ${path}`);
      errors.push(`OpenAPI path without route: ${path}`);
    }
  } else {
    console.log(`${colors.green}✓ All OpenAPI paths have route implementations${colors.reset}`);
  }

  console.log(`\n${colors.blue}Checking routes for OpenAPI definitions...${colors.reset}`);
  const routesMissing: string[] = [];

  for (const [normalizedPath, { routes: routeInfos }] of routesNormalized) {
    const matchedOpenApiPath = matchOpenApiPath(normalizedPath, openApiNormalized);

    if (!matchedOpenApiPath) {
      for (const route of routeInfos) {
        routesMissing.push(`${route.method.toUpperCase()} ${route.path} (${route.file})`);
      }
    }
  }

  if (routesMissing.length > 0) {
    console.log(`${colors.yellow}⚠ Routes WITHOUT OpenAPI definition:${colors.reset}`);
    for (const route of routesMissing) {
      console.log(`  - ${route}`);
      errors.push(`Route without OpenAPI: ${route}`);
    }
  } else {
    console.log(`${colors.green}✓ All routes have OpenAPI definitions${colors.reset}`);
  }

  return { success: errors.length === 0, errors };
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  OpenAPI ↔ Route Coverage Check');
console.log('═══════════════════════════════════════════════════════════\n');

const { success, errors } = compareRouteCoverage();

console.log('\n═══════════════════════════════════════════════════════════');
if (success) {
  console.log(`${colors.green}✓ All checks passed!${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.red}✗ Found ${errors.length} discrepancies${colors.reset}`);
  process.exit(1);
}

