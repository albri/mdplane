// Renders a still for each beat of the film, or for the times in seconds given as arguments, to
// out/stills. Faster than a full render for checking layout.
import { mkdirSync } from 'node:fs'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { inlineFonts } from '../webpack.ts'

// A frame from each beat, once it has settled.
const BEATS = [
  0, 6, 12.5, 18, 25, 33, 42.5, 54, 63, 76.5, 82, 90, 96, 100.4, 107.4, 110.4, 118.7, 123.2, 127.2,
  134.2,
]
const times = process.argv.length > 2 ? process.argv.slice(2).map(Number) : BEATS

const serveUrl = await bundle({
  entryPoint: new URL('../src/index.ts', import.meta.url).pathname,
  webpackOverride: inlineFonts,
})
const composition = await selectComposition({ serveUrl, id: 'mdplane' })
mkdirSync('out/stills', { recursive: true })
for (const sec of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(sec * composition.fps))
  const output = `out/stills/${sec.toFixed(1).padStart(5, '0')}s.png`
  // oxlint-disable-next-line no-await-in-loop -- one browser renders the stills in turn
  await renderStill({ serveUrl, composition, frame, output })
  console.log(output)
}
