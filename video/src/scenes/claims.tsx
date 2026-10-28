import type { ReactNode } from 'react'
import { interpolate } from 'remotion'
import { fade, hhmm, lift, minutes, mix, ramp, useT, Words } from '../motion.tsx'
import { c, font, X } from '../theme.ts'

type Stop = {
  at: number
  time: string
  who?: string
  text: string
  // Not an entry in the log: a refused claim, or a lease running out.
  off?: boolean
  lines?: number
  // A claim holds the task until this time.
  until?: string
  // This stop ends the claim before it, and says how.
  ends?: string
  chip?: ReactNode
}

export function Chip({
  colour,
  dot = true,
  children,
}: {
  colour: string
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        marginLeft: 12,
        padding: '2px 14px',
        borderRadius: 999,
        verticalAlign: 2,
        fontFamily: font.sans,
        fontWeight: 500,
        fontSize: 21,
        lineHeight: 1.4,
        color: colour,
        background: `color-mix(in srgb, ${colour} 11%, ${c.page})`,
      }}
    >
      {dot ? (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
      ) : null}
      {children}
    </span>
  )
}

const LINE = 36
const GAP = 30
const BAR = 34
const height = (s: Stop) => (s.lines ?? 1) * LINE + (s.until ? BAR : 0)

// One task's route: a stop for each event, on a clock that runs between them.
function TaskRoute({
  x,
  title,
  stops,
  dim,
}: {
  x: number
  title: string
  stops: Stop[]
  dim: number
}) {
  const t = useT()
  const keys = stops.map((s) => s.at)
  const now = interpolate(
    t,
    keys,
    stops.map((s) => minutes(s.time)),
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  )
  const tops: number[] = []
  let y = 0
  for (const s of stops) {
    tops.push(y)
    y += height(s) + GAP
  }
  return (
    <div style={{ position: 'absolute', left: x, top: 300, width: 760, opacity: 1 - dim }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: font.sans,
          fontWeight: 650,
          fontSize: 30,
          letterSpacing: '-0.015em',
          color: c.ink,
          opacity: fade(t, (stops[0]?.at ?? 0) - 0.4),
        }}
      >
        {title}
        <span style={{ fontFamily: font.mono, fontWeight: 400, fontSize: 24, color: c.ink3 }}>
          {hhmm(now)}
        </span>
      </div>
      <div style={{ position: 'relative', marginTop: 34 }}>
        {stops.slice(1).map((s, i) => {
          const from = (tops[i] ?? 0) + 18
          const to = (tops[i + 1] ?? 0) + 18
          const k = ramp(t, s.at - 0.35, 0.35)
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 106.5,
                top: from,
                width: 5,
                height: (to - from) * k,
                background: c.action,
              }}
            />
          )
        })}
        {stops.map((s, i) => {
          const end = stops.find((e, j) => j > i && e.ends)
          const over = end !== undefined && t >= end.at
          const left = s.until
            ? Math.max(0, minutes(s.until) - Math.min(now, minutes(end?.time ?? '24:00')))
            : 0
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: tops[i],
                width: 760,
                ...lift(t, s.at, 8),
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 4,
                  fontFamily: font.mono,
                  fontSize: 22,
                  color: c.ink3,
                }}
              >
                {s.time}
              </span>
              <span
                style={{
                  position: 'absolute',
                  left: 98,
                  top: 7,
                  width: 22,
                  height: 22,
                  boxSizing: 'border-box',
                  borderRadius: '50%',
                  background: s.off ? c.page : c.action,
                  border: s.off ? `3px dashed ${c.ink3}` : 'none',
                }}
              />
              <div
                style={{
                  marginLeft: 144,
                  fontFamily: font.sans,
                  fontSize: 26,
                  lineHeight: `${LINE}px`,
                  color: c.ink2,
                }}
              >
                {s.who ? <b style={{ fontWeight: 650, color: c.ink }}>{s.who} </b> : null}
                {s.text}
                {s.chip}
              </div>
              {s.until ? (
                <div
                  style={{
                    marginLeft: 144,
                    marginTop: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    opacity: over ? 0.45 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 240,
                      height: 8,
                      borderRadius: 4,
                      background: c.sunk2,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: `${left * 10}%`, height: '100%', background: c.warn }} />
                  </div>
                  <span style={{ fontFamily: font.mono, fontSize: 20, color: c.ink3 }}>
                    {over ? end.ends : `${Math.ceil(left)} min left`}
                  </span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const A = 0.9
const B = 8.4

// 0–16s. Task #2: a second claim is refused. Task #5: a quiet agent's lease runs out.
export function Claims() {
  const t = useT()
  return (
    <>
      <Words
        text={'Agents claim a task first,\nso two never do the same work.'}
        at={0.3}
        exit={7.7}
        style={{ left: X, top: 110 }}
      />
      <Words
        text={'If an agent goes quiet,\nits claim runs out.'}
        at={8}
        exit={15.6}
        style={{ left: X, top: 110 }}
      />
      <TaskRoute
        x={X}
        title="Task #2: two agents want it"
        dim={mix(0, 0.6, ramp(t, 7.8, 0.6)) + 0.4 * ramp(t, 15.6, 0.4)}
        stops={[
          { at: A, time: '09:01', who: 'alex', text: 'adds the task: upgrade CI to Node 22.' },
          {
            at: A + 1,
            time: '09:04',
            who: 'codex@ci',
            text: 'claims it until 09:14.',
            until: '09:14',
          },
          {
            at: A + 2.1,
            time: '09:06',
            who: 'opencode@vps',
            text: 'tries to claim it too, and is told to wait 8 minutes.',
            off: true,
            lines: 2,
            chip: (
              <Chip colour={c.ink3} dot={false}>
                409
              </Chip>
            ),
          },
          {
            at: A + 4.2,
            time: '09:13',
            who: 'codex@ci',
            text: 'claims it again, until 09:23.',
            until: '09:23',
            ends: 'renewed',
          },
          {
            at: A + 5.6,
            time: '09:19',
            who: 'codex@ci',
            text: 'posts the response.',
            ends: 'released',
            chip: <Chip colour={c.ok}>Done</Chip>,
          },
        ]}
      />
      <TaskRoute
        x={1000}
        title="Task #5: an agent goes quiet"
        dim={ramp(t, 15.6, 0.4)}
        stops={[
          { at: B, time: '09:02', who: 'alex', text: 'adds the task: update the API reference.' },
          {
            at: B + 1,
            time: '09:07',
            who: 'gemini@desktop',
            text: 'claims it until 09:17.',
            until: '09:17',
          },
          {
            at: B + 3.4,
            time: '09:17',
            text: 'Nothing more from gemini@desktop, so the claim runs out and the task is free.',
            off: true,
            lines: 2,
            ends: 'ran out',
          },
          { at: B + 4.4, time: '09:20', who: 'claude@laptop', text: 'claims it.', until: '09:30' },
          {
            at: B + 5.8,
            time: '09:26',
            who: 'claude@laptop',
            text: 'posts its progress.',
            chip: <Chip colour={c.warn}>In progress</Chip>,
          },
        ]}
      />
    </>
  )
}
