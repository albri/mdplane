#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join, relative, resolve } from 'path'

export type FileInput = {
  path: string
  content: string
}

export type DocsRouteViolation = {
  path: string
  line: number
  pattern: string
  context: string
}

const DOCS_PATHS = [
  'apps/docs/content/docs',
  'apps/landing/src',
  'README.md',
  'apps/server/README.md',
  'packages/skills',
  '.opencode/skills',
]

const STALE_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: /\/r\/\{key\}\/files\//g, name: 'Stale read route /r/{key}/files/' },
  { regex: /\/a\/\{key\}\/files\//g, name: 'Stale append route /a/{key}/files/' },
  { regex: /\/w\/\{key\}\/files\//g, name: 'Stale write route /w/{key}/files/' },
  { regex: /urls\.web\.workspace/g, name: 'Stale bootstrap field urls.web.workspace' },
  { regex: /dashboardUrl/g, name: 'Stale field dashboardUrl' },
  { regex: /\/dashboard(?:\/|$)/g, name: 'Stale route /dashboard' },
  { regex: /\/docs\/tools\/api\/api-v1(?=[/?#)\s]|$)/g, name: 'Stale docs link /docs/tools/api/api-v1' },
  { regex: /\/docs\/reference\/errors(?=[/?#)\s]|$)/g, name: 'Stale docs link /docs/reference/errors' },
  { regex: /\/docs\/reference\/limits(?=[/?#)\s]|$)/g, name: 'Stale docs link /docs/reference/limits' },
]

const IGNORE_PATH_PREFIXES = ['node_modules/', '.next/', 'dist/', '.turbo/', 'coverage/', 'build/', '.git/']
const SCAN_EXTENSIONS = new Set(['.md', '.mdx', '.ts', '.tsx', '.js', '.jsx'])

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function shouldIgnorePath(path: string): boolean {
  const normalized = normalizePath(path)
  return IGNORE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix) || normalized.includes(`/${prefix}`))
}

function collectFiles(absPath: string, relPath: string, output: string[]): void {
  if (shouldIgnorePath(relPath)) {
    return
  }

  const stat = statSync(absPath)
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absPath)) {
      collectFiles(join(absPath, entry), normalizePath(`${relPath}/${entry}`), output)
    }
    return
  }

  if (!stat.isFile()) {
    return
  }

  if (!SCAN_EXTENSIONS.has(extname(absPath))) {
    return
  }

  output.push(normalizePath(relPath))
}

export function findStaleDocsRouteViolations(files: FileInput[]): DocsRouteViolation[] {
  const violations: DocsRouteViolation[] = []

  for (const file of files) {
    if (shouldIgnorePath(file.path)) {
      continue
    }

    const lines = file.content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const { regex, name } of STALE_PATTERNS) {
        const matches = line.match(regex)
        if (!matches || matches.length === 0) {
          continue
        }

        violations.push({
          path: file.path,
          line: i + 1,
          pattern: name,
          context: line.trim(),
        })
      }
    }
  }

  return violations
}

function main() {
  console.log('🔍 Checking for stale route examples in docs...\n')

  const workspaceRoot = resolve(import.meta.dir, '..')
  const candidateFiles: string[] = []

  for (const scanRoot of DOCS_PATHS) {
    const absPath = resolve(workspaceRoot, scanRoot)
    try {
      const stat = statSync(absPath)
      if (stat.isDirectory()) {
        collectFiles(absPath, normalizePath(relative(workspaceRoot, absPath)), candidateFiles)
      } else if (stat.isFile()) {
        candidateFiles.push(normalizePath(scanRoot))
      }
    } catch {
      console.log(`⚠️  Skipping ${scanRoot}: not found`)
    }
  }

  const fileInputs: FileInput[] = candidateFiles.map((filePath) => ({
    path: filePath,
    content: readFileSync(resolve(workspaceRoot, filePath), 'utf8'),
  }))

  const violations = findStaleDocsRouteViolations(fileInputs)
  for (const violation of violations) {
    console.log(`❌ ${violation.path}:${violation.line}: ${violation.pattern}`)
    console.log(`   ${violation.context}`)
  }

  console.log(`\n📊 Checked ${candidateFiles.length} files`)
  if (violations.length > 0) {
    console.log('\n❌ Docs route drift check FAILED')
    console.log('Remove stale route examples and field names from docs.')
    process.exit(1)
  }

  console.log('\n✅ No stale route examples found')
}

if (import.meta.main) {
  main()
}

