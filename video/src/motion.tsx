// The film's motion vocabulary. Time is in seconds, so every shot reads like its storyboard row.
import type { CSSProperties, ReactNode } from 'react'
import { Easing, interpolate, useCurrentFrame } from 'remotion'
import { c, font, FPS } from './theme.ts'

export const useT = () => useCurrentFrame() / FPS

// Arrivals use the site's own ease; things that travel between places use a symmetric one.
export const arrive = Easing.bezier(0.2, 0.7, 0.1, 1)
export const travel = Easing.bezier(0.65, 0, 0.35, 1)

// 0 → 1 between `start` and `start + dur` seconds.
export const ramp = (t: number, start: number, dur = 0.5, easing = arrive) =>
  interpolate(t, [start, start + dur], [0, 1], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

export const mix = (a: number, b: number, k: number) => a + (b - a) * k

// A mask line that its content rises into and leaves upwards from.
const mask: CSSProperties = {
  display: 'inline-block',
  overflow: 'hidden',
  verticalAlign: 'top',
  paddingBottom: '0.14em',
  marginBottom: '-0.14em',
}

// A statement, word by word. Each line of `text` is a line on screen.
export function Words({
  text,
  at,
  exit,
  size = 64,
  every = 0.06,
  color = c.ink,
  style,
}: {
  text: string
  at: number
  exit?: number
  size?: number
  every?: number
  color?: string
  style?: CSSProperties
}) {
  const t = useT()
  let i = 0
  return (
    <div
      style={{
        position: 'absolute',
        fontFamily: font.sans,
        fontWeight: 650,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: '-0.03em',
        color,
        ...style,
      }}
    >
      {text.split('\n').map((line, li) => (
        <div key={li} style={{ whiteSpace: 'nowrap' }}>
          {line.split(' ').map((word, wi) => {
            const n = i++
            const enter = ramp(t, at + n * every, 0.6)
            const leave = exit === undefined ? 0 : ramp(t, exit + n * 0.02, 0.35, travel)
            return (
              <span key={wi} data-mask style={{ ...mask, marginRight: '0.24em' }}>
                <span
                  style={{
                    display: 'inline-block',
                    transform: `translateY(${(1 - enter) * 110 - leave * 110}%)`,
                  }}
                >
                  {word}
                </span>
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Any block rising out of its own mask.
export function Rise({
  at,
  exit,
  dur = 0.55,
  style,
  children,
}: {
  at: number
  exit?: number
  dur?: number
  style?: CSSProperties
  children: ReactNode
}) {
  const t = useT()
  const enter = ramp(t, at, dur)
  const leave = exit === undefined ? 0 : ramp(t, exit, 0.35, travel)
  return (
    <div data-mask style={{ position: 'absolute', overflow: 'hidden', ...style }}>
      <div style={{ transform: `translateY(${(1 - enter) * 110 - leave * 110}%)` }}>{children}</div>
    </div>
  )
}

// A block that fades and lifts into place: entries arriving in a list.
export const lift = (t: number, at: number, dist = 14): CSSProperties => {
  const k = ramp(t, at, 0.45)
  return { opacity: k, transform: `translateY(${(1 - k) * dist}px)` }
}

export const fade = (t: number, at: number, exit?: number, dur = 0.4) =>
  ramp(t, at, dur) * (exit === undefined ? 1 : 1 - ramp(t, exit, 0.35, travel))

// Characters of `text` typed by `t`, at `cps` characters a second.
export const typed = (text: string, t: number, at: number, cps = 40) =>
  text.slice(0, Math.max(0, Math.floor((t - at) * cps)))

// Times of day as minutes, and back.
export const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
export const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`
