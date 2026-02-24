#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

type Violation = {
  file: string;
  line: number;
  text: string;
};

const IGNORE_DIRS = new Set(['__tests__', 'node_modules', 'dist', 'build', '.turbo', '.next']);
const DOMAIN_ROOT = 'apps/server/src/domain';

const RULES: RegExp[] = [
  /from\s+['"](?:\.\.\/)+routes(?:\/|['"])/,
  /from\s+['"][^'"]*\/src\/routes(?:\/|['"])/,
  /from\s+['"]@mdplane\/server\/src\/routes(?:\/|['"])/,
];

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function collectDomainFiles(absDir: string, relDir: string, files: string[]): void {
  for (const entry of readdirSync(absDir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const absPath = join(absDir, entry);
    const relPath = normalizePath(join(relDir, entry));
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      collectDomainFiles(absPath, relPath, files);
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
    if (RULES.some((rule) => rule.test(line))) {
      violations.push({ file: filePath, line: i + 1, text: line.trim() });
    }
  }
  return violations;
}

function main(): void {
  const workspaceRoot = resolve(import.meta.dir, '..');
  const domainAbs = resolve(workspaceRoot, DOMAIN_ROOT);
  const files: string[] = [];

  collectDomainFiles(domainAbs, relative(workspaceRoot, domainAbs), files);

  const violations: Violation[] = [];
  for (const file of files) {
    const source = readFileSync(resolve(workspaceRoot, file), 'utf8');
    violations.push(...checkFile(file, source));
  }

  if (violations.length > 0) {
    console.error(`Domain -> routes import violations found (${violations.length}):`);
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.text}`);
    }
    process.exit(1);
  }

  console.log(`Domain route-import check passed (${files.length} files scanned)`);
}

if (import.meta.main) {
  main();
}
