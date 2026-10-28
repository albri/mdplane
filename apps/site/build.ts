// Builds the site into dist/, which the Worker serves as static assets. Scripts, styles and fonts
// are bundled into dist/assets/ under content-hashed names, so they can be cached for good. Pages
// are filled in from src/pages: `{{> name}}` includes partials/name.html, and `{{file}}` becomes
// the hashed URL of that output, such as `{{main.css}}` or `{{landing.js}}`.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { build, type BuildOptions, type Metafile } from 'esbuild'

const root = new URL('.', import.meta.url)
const dist = new URL('dist/', root)
const pages = new URL('src/pages/', root)

const common = {
  absWorkingDir: root.pathname,
  bundle: true,
  minify: true,
  sourcemap: 'linked',
  // The oldest browsers with everything the pages use, such as light-dark() and popovers.
  target: ['chrome123', 'edge123', 'firefox125', 'safari17.5'],
  outdir: 'dist/assets',
  entryNames: '[name]-[hash]',
  chunkNames: 'chunk-[hash]',
  assetNames: '[name]-[hash]',
  legalComments: 'linked',
  metafile: true,
  logLevel: 'warning',
} satisfies BuildOptions

rmSync(dist, { recursive: true, force: true })
cpSync(new URL('public/', root), dist, { recursive: true })

const [modules, classic] = await Promise.all([
  build({
    ...common,
    entryPoints: [
      'src/landing.ts',
      'src/demo.ts',
      'src/link.ts',
      'src/page.ts',
      'src/styles/main.css',
    ],
    format: 'esm',
    splitting: true,
    loader: { '.woff2': 'file' },
  }),
  // A classic script, run before the stylesheet applies so a chosen theme doesn't flash.
  build({ ...common, entryPoints: ['src/theme.ts'], format: 'iife' }),
])
const outputs: Metafile['outputs'] = { ...modules.metafile.outputs, ...classic.metafile.outputs }
const url = (file: string) => `/${file.replace(/^dist\//, '')}`

// Entry points by their source name, and fonts by their file name.
const assets = new Map<string, string>()
for (const [file, output] of Object.entries(outputs)) {
  const source = output.entryPoint ?? (file.endsWith('.woff2') ? Object.keys(output.inputs)[0] : '')
  if (source) assets.set(basename(source).replace(/\.ts$/, '.js'), url(file))
}

// Chunks a module imports, so the page can fetch them alongside it instead of after it.
const preloads = (src: string) =>
  (outputs[`dist${src}`]?.imports ?? [])
    .filter((i) => i.kind === 'import-statement' && !i.external)
    .map((i) => `<link rel="modulepreload" href="${url(i.path)}" />`)

const read = (path: string) => readFileSync(new URL(path, pages), 'utf8')

function include(html: string): string {
  return html.replace(/^([ \t]*)\{\{> ([\w-]+)\}\}$/gm, (_, indent: string, name: string) =>
    include(read(`partials/${name}.html`))
      .trimEnd()
      .replace(/^(?=.)/gm, indent),
  )
}

function fill(html: string): string {
  return html
    .replace(/\{\{([\w.-]+)\}\}/g, (_, name: string) => {
      const found = assets.get(name)
      if (!found) throw new Error(`No built file for {{${name}}}`)
      return found
    })
    .replace(
      /^([ \t]*)(<script type="module" src="([^"]+)"><\/script>)$/gm,
      (_, indent: string, tag: string, src: string) =>
        [tag, ...preloads(src)].map((line) => `${indent}${line}`).join('\n'),
    )
}

for (const page of readdirSync(pages).filter((name) => name.endsWith('.html'))) {
  writeFileSync(new URL(page, dist), fill(include(read(page))))
}

// The fonts' licences travel with them.
mkdirSync(new URL('licenses/', dist), { recursive: true })
for (const [font, pkg] of [
  ['schibsted-grotesk', '@fontsource-variable/schibsted-grotesk'],
  ['fragment-mono', '@fontsource/fragment-mono'],
]) {
  cpSync(new URL(`node_modules/${pkg}/LICENSE`, root), new URL(`licenses/${font}.txt`, dist))
}
