// The landing page's light tokens and fonts (apps/site/src/styles/tokens.css), at film scale.
import monoUrl from '@fontsource/fragment-mono/files/fragment-mono-latin-400-normal.woff2'
import sansUrl from '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2'
import { loadFont } from '@remotion/fonts'

export const FPS = 60
export const W = 1920
export const H = 1080

export const c = {
  page: '#ffffff',
  sunk: '#f4f6f9',
  sunk2: '#e8ecf2',
  line: '#e1e5ec',
  lineStrong: '#c8cfda',
  ink: '#0b1222',
  ink2: '#475165',
  ink3: '#5f687a',
  action: '#9c3b17',
  actionTint: '#fbeee8',
  ok: '#10795a',
  warn: '#9a5b00',
  bad: '#b42318',
}

export const font = {
  sans: "'Schibsted Grotesk', system-ui, sans-serif",
  mono: "'Fragment Mono', ui-monospace, monospace",
}

// The page's left edge and width, shared by every shot.
export const X = 160
export const WIDTH = W - 2 * X

void loadFont({ family: 'Schibsted Grotesk', url: sansUrl, weight: '400 900', format: 'woff2' })
void loadFont({ family: 'Fragment Mono', url: monoUrl, weight: '400', format: 'woff2' })
