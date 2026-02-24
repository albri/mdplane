#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, isAbsolute, join, resolve } from 'path'

function parseArgs(argv) {
  const out = { db: undefined, output: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--db') out.db = argv[++i]
    else if (arg === '--out') out.output = argv[++i]
    else if (arg === '--help' || arg === '-h') out.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return out
}

function timestamp() {
  const now = new Date()
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}-${hh}${mm}${ss}`
}

function resolvePath(input) {
  if (!input) return undefined
  return isAbsolute(input) ? input : resolve(process.cwd(), input)
}

function resolveDbPath(cliValue) {
  const candidates = [
    resolvePath(cliValue),
    resolvePath(process.env.DATABASE_URL),
    resolve(process.cwd(), 'apps/server/data/mdplane.sqlite'),
    resolve(process.cwd(), 'data/mdplane.sqlite'),
    '/data/mdplane.sqlite',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  const tried = candidates.join(', ')
  throw new Error(`Could not find sqlite database file. Tried: ${tried}`)
}

function resolveOutputPath(cliValue) {
  if (cliValue) {
    const resolved = resolvePath(cliValue)
    if (resolved.endsWith('.sqlite')) return resolved
    return join(resolved, `mdplane-backup-${timestamp()}.sqlite`)
  }
  return resolve(process.cwd(), 'backups', `mdplane-backup-${timestamp()}.sqlite`)
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return false
  copyFileSync(from, to)
  return true
}

function printUsage() {
  console.log('Usage: node scripts/sqlite-backup.mjs [--db <path>] [--out <path-or-dir>]')
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    process.exit(0)
  }

  const dbPath = resolveDbPath(args.db)
  const outputPath = resolveOutputPath(args.output)

  mkdirSync(dirname(outputPath), { recursive: true })
  copyFileSync(dbPath, outputPath)
  const walCopied = copyIfExists(`${dbPath}-wal`, `${outputPath}-wal`)
  const shmCopied = copyIfExists(`${dbPath}-shm`, `${outputPath}-shm`)

  console.log(`Backup created: ${outputPath}`)
  console.log(`Source database: ${dbPath}`)
  if (walCopied || shmCopied) {
    console.log(`Copied WAL sidecars: wal=${walCopied} shm=${shmCopied}`)
  }
  console.log('Note: for strict consistency, run backup while the server is stopped.')
} catch (error) {
  console.error(`sqlite-backup failed: ${error.message}`)
  printUsage()
  process.exit(1)
}
