import { interpolateColors } from 'remotion'
import { fade, ramp, travel, useT, Words } from '../motion.tsx'
import { Mark } from '../route.tsx'
import { c, font, X } from '../theme.ts'

export const AGENTS = ['claude@laptop', 'codex@ci', 'opencode@vps', 'gemini@desktop']

// 0–7s. The logo arrives in the middle and moves to the footer (in Film); then the line.
export function Hero() {
  return (
    <Words
      text={'A shared worklog\nany agent can join\nwith one URL.'}
      at={2.6}
      exit={6.5}
      size={118}
      every={0.07}
      style={{ left: X, top: 300, letterSpacing: '-0.034em', lineHeight: 1.02 }}
    />
  )
}

// A line drawn along its own length.
export function Path({
  d,
  k,
  color,
  width = 5,
  dash,
}: {
  d: string
  k: number
  color: string
  width?: number
  dash?: string
}) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="butt"
      strokeDasharray={dash ?? '1 1'}
      strokeDashoffset={dash ? 0 : 1 - k}
      opacity={dash ? k : 1}
    />
  )
}

const ROW = (i: number) => 400 + i * 104
const SPLIT_END = 1000
const JOIN = { x: 1290, y: 556 }
const FILE = { x: 1500, y: JOIN.y }

// 0–7.5s. Agents in different tools have no shared place; mdplane gives them one.
export function Why() {
  const t = useT()
  const joined = ramp(t, 4.3, 1.1)
  const shown = fade(t, 0, 6.9)
  return (
    <>
      <Words
        text={'Your agents work in different tools,\non different machines.'}
        at={0.2}
        exit={3.7}
        style={{ left: X, top: 110 }}
      />
      <Words
        text={'mdplane gives them one place\nto share the work.'}
        at={4}
        exit={6.9}
        style={{ left: X, top: 110 }}
      />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: shown }}>
        {AGENTS.map((agent, i) => {
          const y = ROW(i)
          const color = interpolateColors(joined, [0, 1], [c.lineStrong, c.action])
          return (
            <g key={agent}>
              <Path
                d={`M 520 ${y} L ${SPLIT_END} ${y}`}
                k={ramp(t, 0.8 + i * 0.15, 1)}
                color={color}
              />
              <circle
                cx={SPLIT_END}
                cy={y}
                r={9}
                fill={c.page}
                stroke={c.lineStrong}
                strokeWidth={4}
                opacity={ramp(t, 1.6 + i * 0.15, 0.3) * (1 - ramp(t, 4.2, 0.3))}
              />
              <Path
                d={`M ${SPLIT_END} ${y} C ${SPLIT_END + 160} ${y}, ${JOIN.x - 160} ${JOIN.y}, ${JOIN.x} ${JOIN.y}`}
                k={ramp(t, 4.4 + i * 0.08, 0.9, travel)}
                color={c.action}
              />
            </g>
          )
        })}
        <Path
          d={`M ${JOIN.x} ${JOIN.y} L ${FILE.x - 10} ${FILE.y}`}
          k={ramp(t, 5.1, 0.6)}
          color={c.action}
          width={7}
        />
      </svg>
      {AGENTS.map((agent, i) => (
        <div
          key={agent}
          style={{
            position: 'absolute',
            left: X,
            top: ROW(i) - 20,
            fontFamily: font.mono,
            fontSize: 32,
            lineHeight: '40px',
            color: c.ink,
            opacity: fade(t, 0.5 + i * 0.15) * shown,
          }}
        >
          {agent}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: FILE.x,
          top: FILE.y - 60,
          display: 'grid',
          justifyItems: 'start',
          gap: 18,
          opacity: fade(t, 5.4) * shown,
        }}
      >
        <Mark size={120} />
        <div style={{ fontFamily: font.mono, fontSize: 30, color: c.ink }}>queue.md</div>
      </div>
    </>
  )
}
