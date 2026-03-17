#!/usr/bin/env node
/**
 * Clean Next.js cache before builds to avoid stale cache issues.
 * On Windows, Next.js 15.5.x has a race condition with .next/export directory.
 * This script aggressively retries removal to work around the issue.
 */
import { rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const nextDir = join(__dirname, '..', '.next')
const exportDir = join(nextDir, 'export')

async function removeWithRetry(dir, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      }
      return true
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`Retry ${i + 1}/${maxRetries} removing ${dir}...`)
        await new Promise(r => setTimeout(r, 200 * (i + 1)))
      } else {
        console.warn(`Warning: Could not remove ${dir}: ${err.message}`)
        return false
      }
    }
  }
  return false
}

// First try to remove just the export dir (common Windows issue)
if (existsSync(exportDir)) {
  console.log('Cleaning .next/export directory...')
  await removeWithRetry(exportDir)
}

// Then clean the whole .next directory
if (existsSync(nextDir)) {
  console.log('Cleaning .next directory...')
  await removeWithRetry(nextDir)
  console.log('Done.')
} else {
  console.log('No .next directory to clean.')
}

