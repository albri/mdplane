#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

type Violation = {
  file: string;
  line: number;
  rule: string;
  text: string;
};

const IGNORE_DIRS = new Set(['__tests__', 'node_modules', 'dist', 'build', '.turbo', '.next']);
const ROUTES_ROOT = 'apps/server/src/routes';

const RULES: Array<{ name: string; regex: RegExp }> = [
  { name: 'db import', regex: /from\s+['"]\.\.\/db(?:\/|['"])/ },
  { name: 'db usage', regex: /\bdb\.(query|insert|update|delete|select|execute)\b/ },
  { name: 'sqlite usage', regex: /\bsqlite\.(query|exec|prepare|run)\b/ },
];

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function collectRouteFiles(absDir: string, relDir: string, files: string[]): void {
  for (const entry of readdirSync(absDir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const absPath = join(absDir, entry);
    const relPath = normalizePath(join(relDir, entry));
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      collectRouteFiles(absPath, relPath, files);
      continue;
    }
    if (stat.isFile() && relPath.endsWith('.ts')) {
      files.push(relPath);
    }
  }
}

function checkFile(filePath: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of RULES) {
      if (rule.regex.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          rule: rule.name,
          text: line.trim(),
        });
      }
    }
  }
  return violations;
}

function main(): void {
  const workspaceRoot = resolve(import.meta.dir, '..');
  const routesAbs = resolve(workspaceRoot, ROUTES_ROOT);
  const routeFiles: string[] = [];

  collectRouteFiles(routesAbs, relative(workspaceRoot, routesAbs), routeFiles);

  const violations: Violation[] = [];
  for (const file of routeFiles) {
    const source = readFileSync(resolve(workspaceRoot, file), 'utf8');
    violations.push(...checkFile(file, source));
  }

  if (violations.length > 0) {
    console.error(`Route DB usage violations found (${violations.length}):`);
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.text}`);
    }
    process.exit(1);
  }

  console.log(`Route DB usage check passed (${routeFiles.length} files scanned)`);
}

if (import.meta.main) {
  main();
}
