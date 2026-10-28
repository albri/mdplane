// Builds the site into dist/, which the Worker serves as static assets. Pages and styles are
// copied as they are; scripts are bundled so the browser runs the contract's own code.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { build } from 'esbuild'

const src = new URL('src/', import.meta.url)
const dist = new URL('dist/', import.meta.url)
const fonts = new URL('fonts/', dist)
const modules = new URL('node_modules/', import.meta.url)

rmSync(dist, { recursive: true, force: true })
mkdirSync(fonts, { recursive: true })

for (const file of ['index.html', 'reader.html', '404.html', 'site.css', 'icon.svg', '_headers']) {
  cpSync(new URL(file, src), new URL(file, dist))
}

const FONT_FILES = {
  'schibsted-grotesk-latin.woff2':
    '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2',
  'schibsted-grotesk-latin-ext.woff2':
    '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-ext-wght-normal.woff2',
  'schibsted-grotesk-LICENSE.txt': '@fontsource-variable/schibsted-grotesk/LICENSE',
  'fragment-mono-latin.woff2':
    '@fontsource/fragment-mono/files/fragment-mono-latin-400-normal.woff2',
  'fragment-mono-latin-ext.woff2':
    '@fontsource/fragment-mono/files/fragment-mono-latin-ext-400-normal.woff2',
  'fragment-mono-LICENSE.txt': '@fontsource/fragment-mono/LICENSE',
}
for (const [name, from] of Object.entries(FONT_FILES))
  cpSync(new URL(from, modules), new URL(name, fonts))

const shared = { bundle: true, minify: true, target: 'es2022', legalComments: 'none' } as const
await build({
  ...shared,
  entryPoints: { landing: 'src/landing.ts', reader: 'src/reader-page.ts' },
  outdir: 'dist',
  format: 'esm',
  absWorkingDir: new URL('.', import.meta.url).pathname,
})
// Classic script, loaded before the stylesheet applies.
await build({
  ...shared,
  entryPoints: { theme: 'src/theme.ts' },
  outdir: 'dist',
  format: 'iife',
  absWorkingDir: new URL('.', import.meta.url).pathname,
})
