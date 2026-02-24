#!/usr/bin/env node
import { copyFileSync, existsSync, rmSync } from 'fs'
import { dirname, isAbsolute, join, resolve } from 'path'

function parseArgs(argv) {
  const out = { from: undefined, db: undefined, yes: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--from') out.from = argv[++i]
    else if (arg === '--db') out.db = argv[++i]
    else if (arg === '--yes') out.yes = true
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

  if (candidates.length > 0) {
    return candidates[0]
  }
  throw new Error('Could not resolve target database path')
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return false
  copyFileSync(from, to)
  return true
}

function removeIfExists(path) {
  if (existsSync(path)) rmSync(path, { force: true })
}

function printUsage() {
  console.log('Usage: node scripts/sqlite-restore.mjs --from <backup.sqlite> [--db <path>] --yes')
}

try {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    process.exit(0)
  }
  if (!args.from) throw new Error('--from is required')
  if (!args.yes) throw new Error('Pass --yes to confirm destructive restore')

  const sourcePath = resolvePath(args.from)
  if (!existsSync(sourcePath)) {
    throw new Error(`Backup file does not exist: ${sourcePath}`)
  }

  const dbPath = resolveDbPath(args.db)
  const preRestorePath = join(
    dirname(dbPath),
    `mdplane-pre-restore-${timestamp()}.sqlite`
  )

  if (existsSync(dbPath)) {
    copyFileSync(dbPath, preRestorePath)
    copyIfExists(`${dbPath}-wal`, `${preRestorePath}-wal`)
    copyIfExists(`${dbPath}-shm`, `${preRestorePath}-shm`)
    console.log(`Pre-restore backup created: ${preRestorePath}`)
  }

  copyFileSync(sourcePath, dbPath)

  const sourceWal = `${sourcePath}-wal`
  const sourceShm = `${sourcePath}-shm`
  const targetWal = `${dbPath}-wal`
  const targetShm = `${dbPath}-shm`

  if (existsSync(sourceWal)) copyFileSync(sourceWal, targetWal)
  else removeIfExists(targetWal)

  if (existsSync(sourceShm)) copyFileSync(sourceShm, targetShm)
  else removeIfExists(targetShm)

  console.log(`Restore complete: ${sourcePath} -> ${dbPath}`)
  console.log('Run restore only while server is stopped.')
} catch (error) {
  console.error(`sqlite-restore failed: ${error.message}`)
  printUsage()
  process.exit(1)
}
