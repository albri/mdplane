// Fails when a page sends more gzipped JavaScript than its budget. README.md says the site sends
// about 30 KB, and this keeps that true: raise the budget only with the README.
//
// It reads the built pages in dist/, so run it after the build, as `pnpm check` does.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BUDGET = 32_000
const PAGES = { '/': 'index.html', '/demo': 'demo.html', reader: 'reader.html' }

const dist = new URL('dist/', import.meta.url)
const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} KB`

const SCRIPT = /<(?:script|link rel="modulepreload")[^>]*\b(?:src|href)="([^"]+\.js)"/g
// esbuild writes each import as from"./x.js", import"./x.js" or import("./x.js").
const IMPORT = /\b(?:from|import)\s*\(?\s*"(\.\.?\/[^"]+\.js)"/g

// Every script a page loads and every module those import, as a browser fetches them, each
// gzipped on its own as it is served.
function weight(page: string): number {
  const html = readFileSync(new URL(page, dist), 'utf8')
  const queue = [...html.matchAll(SCRIPT)].map(([, src = '']) => new URL(`.${src}`, dist))
  const seen = new Set<string>()
  let total = 0
  for (const file of queue) {
    if (seen.has(file.href)) continue
    seen.add(file.href)
    const code = readFileSync(file)
    total += gzipSync(code).length
    for (const [, path = ''] of code.toString().matchAll(IMPORT)) queue.push(new URL(path, file))
  }
  return total
}

let over = false
for (const [name, page] of Object.entries(PAGES)) {
  const bytes = weight(page)
  over ||= bytes > BUDGET
  console.log(
    `${bytes > BUDGET ? 'OVER' : 'ok  '}  ${name.padEnd(8)} ${kb(bytes)} of ${kb(BUDGET)}`,
  )
}
if (over) {
  console.log(
    'A page is over its JavaScript budget. Make it smaller, or raise BUDGET with README.md.',
  )
  process.exitCode = 1
}
