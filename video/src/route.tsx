// The two objects that stay on screen across shots: the four-stop route from "How it works",
// which docks in the footer to show where the film has got to, and the logo.
import { interpolateColors } from 'remotion'
import { arrive, mix, ramp, travel, useT } from './motion.tsx'
import { c, font, X } from './theme.ts'

export const STEPS = [
  'Write the job',
  'Hand out the link',
  'Agents claim and report',
  'Watch and check',
]

const COL = 410
const STOP = 56
const RING = 5
const LABEL = 31

// Where the route sits drawn in full, and docked in the footer at half size.
const BIG = { x: X, y: 470, s: 1 }
const DOCK = { x: 1000, y: 972, s: 0.5 }

export function Route({
  drawAt,
  dockAt,
  reachAt,
  leaveAt,
}: {
  // When each stop and the line to it are drawn in.
  drawAt: number[]
  dockAt: number
  // When each step becomes the current one, once docked.
  reachAt: number[]
  leaveAt: number
}) {
  const t = useT()
  const dock = ramp(t, dockAt, 1.1, travel)
  const x = mix(BIG.x, DOCK.x, dock)
  const y = mix(BIG.y, DOCK.y, dock)
  const s = mix(BIG.s, DOCK.s, dock)
  const gone = ramp(t, leaveAt, 0.5, travel)
  // Docked, the route shows progress: stops reached so far are filled, the line ahead is grey.
  const reached = (i: number) => ramp(t, reachAt[i] ?? 1e6, 0.6)
  const ahead = (i: number) => dock * (1 - reached(i))
  const current = (i: number) => reached(i) - (i < 3 ? reached(i + 1) : 0)
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px) scale(${s})`,
        transformOrigin: '0 0',
        opacity: 1 - gone,
      }}
    >
      {STEPS.map((label, i) => {
        const shown = ramp(t, drawAt[i] ?? 0, 0.5)
        const line = ramp(t, (drawAt[i] ?? 0) + 0.2, 0.7)
        const stopColor = interpolateColors(ahead(i), [0, 1], [c.action, c.lineStrong])
        const lineColor = interpolateColors(ahead(i + 1), [0, 1], [c.action, c.lineStrong])
        const fill = interpolateColors(dock * reached(i), [0, 1], [c.page, c.action])
        const number = interpolateColors(dock * reached(i), [0, 1], [c.action, c.page])
        return (
          <div key={label} style={{ position: 'absolute', left: i * COL, top: 0 }}>
            {i < 3 ? (
              <div
                style={{
                  position: 'absolute',
                  left: STOP - 1,
                  top: STOP / 2 - RING / 2,
                  width: (COL - STOP + 2) * line,
                  height: RING,
                  background: lineColor,
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: STOP,
                height: STOP,
                boxSizing: 'border-box',
                border: `${RING}px solid ${stopColor}`,
                borderRadius: '50%',
                background: fill,
                display: 'grid',
                placeItems: 'center',
                fontFamily: font.sans,
                fontWeight: 650,
                fontSize: 24,
                color: interpolateColors(ahead(i), [0, 1], [number, c.ink3]),
                opacity: shown,
                transform: `scale(${mix(0.7, 1, shown)})`,
              }}
            >
              {i + 1}
            </div>
            <div
              data-mask
              style={{ position: 'absolute', left: 0, top: STOP + 20, overflow: 'hidden' }}
            >
              <div
                style={{
                  transform: `translateY(${(1 - ramp(t, (drawAt[i] ?? 0) + 0.15, 0.6, arrive)) * 110}%)`,
                  fontFamily: font.sans,
                  fontWeight: 650,
                  fontSize: LABEL,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  color: interpolateColors(dock * (1 - current(i)), [0, 1], [c.ink, c.ink3]),
                  paddingBottom: 6,
                }}
              >
                {label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// The mark from apps/site/public/icon.svg: the file's body, and the log below it.
export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ display: 'block' }}>
      <rect x="2" y="2" width="18" height="10" rx="2.5" fill={c.ink} />
      <rect x="2" y="14" width="18" height="2.4" rx="1.2" fill={c.action} />
      <rect x="2" y="18.4" width="11" height="2.4" rx="1.2" fill={c.action} opacity={0.5} />
    </svg>
  )
}

// The logo: centred and large at the start and the end, small in the footer in between. It is
// drawn from the first frame, because that frame is all GitHub's player shows before you press play.
export function Lockup({ dockAt, undockAt }: { dockAt: number; undockAt: number }) {
  const t = useT()
  const big = 1 - ramp(t, dockAt, 1.1, travel) + ramp(t, undockAt, 1.1, travel)
  const S = 3.6
  const WIDTH = 150
  const s = mix(1, S, big)
  const left = mix(X, 960 - (WIDTH * S) / 2, big)
  const top = mix(1000, 470, big)
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: top - 16,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        transform: `scale(${s})`,
        transformOrigin: '0 50%',
      }}
    >
      <Mark size={31} />
      <span
        style={{
          fontFamily: font.sans,
          fontWeight: 650,
          fontSize: 27,
          letterSpacing: '-0.02em',
          color: c.ink,
        }}
      >
        mdplane
      </span>
    </div>
  )
}
