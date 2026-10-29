import { fade, mix, ramp, travel, typed, useT, Words } from '../motion.tsx'
import { c, font, X } from '../theme.ts'
import { AGENTS, Path } from './open.tsx'

// A made-up key, masked the way the reader masks one.
export const KEY = 'wk_7Qm2x9Lp4Rt8.••••'

// What each link can do, as stops a line reaches or doesn't: the permissions table on the
// landing page, drawn as routes.
const STATIONS = [
  'Read and\nwatch live',
  'Add entries and\nclaim tasks',
  'Edit files and\nmanage links',
]
const STATION_X = [1010, 1300, 1590]
const LINKS = [
  { name: 'Read', tier: 'r', reach: 0 },
  { name: 'Append', tier: 'a', reach: 1 },
  { name: 'Write', tier: 'w', reach: 2 },
]
const ROW_Y = (i: number) => 470 + i * 140
const LINE_FROM = 840

const FAN = { x: 1000, y: 560 }
const AGENT_Y = (i: number) => 410 + i * 100

// 0–20.8s. The three links reach different stops. Then one append link goes to four agents.
export function Link() {
  const t = useT()
  const table = fade(t, 1.4, 11.7)
  const focus = ramp(t, 9.8, 0.5)
  return (
    <>
      <Words
        text="The link decides what an agent can do."
        at={0.3}
        exit={11.7}
        style={{ left: X, top: 110 }}
      />
      <Words
        text={"Paste it into any agent.\nThere's nothing to install."}
        at={12.3}
        exit={20.2}
        style={{ left: X, top: 110 }}
      />

      <div style={{ position: 'absolute', inset: 0, opacity: table }}>
        {STATIONS.map((name, j) => (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: (STATION_X[j] ?? 0) - 140,
              width: 280,
              top: 290,
              textAlign: 'center',
              fontFamily: font.sans,
              fontWeight: 600,
              fontSize: 26,
              lineHeight: 1.25,
              whiteSpace: 'pre',
              color: c.ink2,
              opacity: fade(t, 1.6 + j * 0.15),
            }}
          >
            {name}
          </div>
        ))}
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          {STATION_X.map((x) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={386}
              y2={ROW_Y(2) + 50}
              stroke={c.line}
              strokeWidth={1}
              opacity={fade(t, 1.6)}
            />
          ))}
          {LINKS.map((link, i) => {
            const y = ROW_Y(i)
            const end = STATION_X[link.reach] ?? 0
            const at = 3 + i * 1.6
            const k = ramp(t, at, 0.9, travel)
            const dim = link.tier === 'a' ? 0 : focus * 0.7
            return (
              <g key={link.tier} opacity={1 - dim}>
                <Path d={`M ${LINE_FROM} ${y} L ${end} ${y}`} k={k} color={c.action} />
                {STATION_X.map((x, j) => {
                  const reached = j <= link.reach
                  const on = ramp(t, at + ((x - LINE_FROM) / (end - LINE_FROM)) * 0.75, 0.25)
                  return reached ? (
                    <circle key={x} cx={x} cy={y} r={13} fill={c.action} opacity={on} />
                  ) : (
                    <circle
                      key={x}
                      cx={x}
                      cy={y}
                      r={10}
                      fill={c.page}
                      stroke={c.lineStrong}
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      opacity={fade(t, at + 0.9)}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
        {LINKS.map((link, i) => (
          <div
            key={link.tier}
            style={{
              position: 'absolute',
              left: X,
              top: ROW_Y(i) - 46,
              opacity: fade(t, 2.8 + i * 1.6) * (1 - (link.tier === 'a' ? 0 : focus * 0.7)),
            }}
          >
            <div
              style={{
                fontFamily: font.sans,
                fontWeight: 650,
                fontSize: 34,
                letterSpacing: '-0.02em',
                color: c.ink,
              }}
            >
              {link.name}
            </div>
            <div style={{ marginTop: 4, fontFamily: font.mono, fontSize: 24, color: c.ink3 }}>
              mdplane.dev/{link.tier}/<span style={{ color: c.ink }}>{KEY}</span>
            </div>
          </div>
        ))}
      </div>

      <Handout t={t} />
    </>
  )
}

function Handout({ t }: { t: number }) {
  const shown = fade(t, 13.6, 20.2)
  const prompt = `Read mdplane.dev/a/${KEY}\nand follow the instructions.`
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: shown }}>
      <div
        style={{
          position: 'absolute',
          left: X,
          top: FAN.y - 72,
          width: 780,
          height: 144,
          boxSizing: 'border-box',
          padding: '28px 32px',
          border: `1px solid ${c.lineStrong}`,
          borderRadius: 14,
          background: c.page,
          fontFamily: font.mono,
          fontSize: 28,
          lineHeight: 1.6,
          whiteSpace: 'pre',
          color: c.ink,
        }}
      >
        {typed(prompt, t, 14, 40)}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {AGENTS.map((agent, i) => {
          const y = AGENT_Y(i)
          const at = 16.4 + i * 0.12
          return (
            <g key={agent}>
              <Path
                d={`M ${X + 780} ${FAN.y} L ${FAN.x} ${FAN.y} C ${FAN.x + 140} ${FAN.y}, ${1240 - 140} ${y}, 1240 ${y}`}
                k={ramp(t, at, 0.9, travel)}
                color={c.action}
              />
              <circle cx={1252} cy={y} r={13} fill={c.action} opacity={ramp(t, at + 0.8, 0.25)} />
            </g>
          )
        })}
      </svg>
      {AGENTS.map((agent, i) => (
        <div
          key={agent}
          style={{
            position: 'absolute',
            left: 1290,
            top: AGENT_Y(i) - 20,
            fontFamily: font.mono,
            fontSize: 32,
            lineHeight: '40px',
            color: c.ink,
            opacity: fade(t, 17 + i * 0.12),
            transform: `translateX(${mix(12, 0, ramp(t, 17 + i * 0.12, 0.45))}px)`,
          }}
        >
          {agent}
        </div>
      ))}
    </div>
  )
}
