import { fade, useT } from '../motion.tsx'
import { c, font } from '../theme.ts'

// 0–7s. The logo comes back to the middle (in Film), with the line and the address under it.
export function Close() {
  const t = useT()
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 578,
        display: 'grid',
        justifyItems: 'center',
        gap: 22,
      }}
    >
      <div
        style={{
          fontFamily: font.sans,
          fontWeight: 650,
          fontSize: 50,
          letterSpacing: '-0.025em',
          color: c.ink,
          opacity: fade(t, 1.4, undefined, 0.6),
        }}
      >
        A shared worklog any agent can join with one URL.
      </div>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: 32,
          color: c.action,
          opacity: fade(t, 1.9, undefined, 0.6),
        }}
      >
        mdplane.dev
      </div>
    </div>
  )
}
