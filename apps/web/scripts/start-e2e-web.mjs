#!/usr/bin/env node
import { existsSync, cpSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn, spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = join(__dirname, '..')
const nextCli = join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

function runOrExit(command, args) {
  const result = spawnSync(command, args, {
    cwd: webRoot,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.error) {
    console.error(`[start-e2e-web] command failed: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

runOrExit(process.execPath, [join(webRoot, 'scripts', 'clean-next.mjs')])
runOrExit(process.execPath, [nextCli, 'build'])

const standaloneCandidates = [
  join(webRoot, '.next', 'standalone', 'server.js'),
  // Next monorepo standalone output can nest by workspace path.
  join(webRoot, '.next', 'standalone', 'apps', 'web', 'server.js'),
]
const standaloneServer = standaloneCandidates.find((candidate) => existsSync(candidate))
const useStandalone = Boolean(standaloneServer)

if (useStandalone && standaloneServer) {
  const standaloneRoot = dirname(standaloneServer)
  const sourceStatic = join(webRoot, '.next', 'static')
  const targetStatic = join(standaloneRoot, '.next', 'static')
  const sourcePublic = join(webRoot, 'public')
  const targetPublic = join(standaloneRoot, 'public')

  if (existsSync(sourceStatic)) {
    mkdirSync(dirname(targetStatic), { recursive: true })
    cpSync(sourceStatic, targetStatic, { recursive: true, force: true })
  }

  if (existsSync(sourcePublic)) {
    cpSync(sourcePublic, targetPublic, { recursive: true, force: true })
  }
}

const command = process.execPath
const args = useStandalone
  ? [standaloneServer]
  : [nextCli, 'start', '--port', '3000']

const child = spawn(command, args, {
  cwd: webRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: process.env.PORT || '3000',
  },
})

child.on('error', (error) => {
  console.error('[start-e2e-web] failed to start server:', error.message)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

const relaySignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => relaySignal('SIGINT'))
process.on('SIGTERM', () => relaySignal('SIGTERM'))
