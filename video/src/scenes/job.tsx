import type { Entry } from '@mdplane/contract/core'
import type { CSSProperties } from 'react'
import { lift, mix, ramp, typed, useT, Words } from '../motion.tsx'
import { c, font, WIDTH, X } from '../theme.ts'

export const TYPE_COLOUR: Record<Entry['type'], string> = {
  task: c.ink,
  claim: c.warn,
  response: c.ok,
  comment: c.ink2,
  cancel: c.ink3,
  write: c.action,
  delete: c.bad,
}

// Markdown source, with its syntax quieter than its words.
function Source({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const mark = /^(#+ |- )/.exec(line)?.[0] ?? ''
        const parts = line.slice(mark.length).split('`')
        return (
          <div key={i} style={{ minHeight: 39 }}>
            <span style={{ color: c.ink3 }}>{mark}</span>
            {parts.map((part, j) => (
              <span key={j}>
                {j > 0 ? <span style={{ color: c.ink3 }}>`</span> : null}
                <span style={{ color: line.startsWith('# ') ? c.ink : j % 2 ? c.ink : c.ink2 }}>
                  {part}
                </span>
              </span>
            ))}
          </div>
        )
      })}
    </>
  )
}

export function LogRow({ entry, style }: { entry: Entry; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 112px 236px 1fr',
        alignItems: 'baseline',
        fontFamily: font.mono,
        fontSize: 24,
        lineHeight: '44px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span style={{ color: c.ink3 }}>#{entry.seq}</span>
      <span style={{ color: TYPE_COLOUR[entry.type] }}>{entry.type}</span>
      <span style={{ color: c.ink2 }}>{entry.author}</span>
      <span style={{ color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.ref === null ? '' : <span style={{ color: c.ink3 }}>→ #{entry.ref} </span>}
        {entry.body}
      </span>
    </div>
  )
}

const BODY_AT = 2.2
// The lead agent's four tasks arrive together, then the two claims.
const LOG_AT = [9.9, 10.45, 11, 11.55, 12.4, 13.1]
const SHOWN = [2, 3, 4, 5, 6, 7]

// 0–17.1s. The brief is typed at the top of queue.md; the log grows below it.
export function Job({ entries, body }: { entries: Entry[]; body: string }) {
  const t = useT()
  const rows = SHOWN.map((seq) => entries[seq - 1]).filter((e) => e !== undefined)
  const grown = LOG_AT.reduce((n, at) => n + ramp(t, at, 0.45), 0)
  const card = lift(t, 1.6, 20)
  return (
    <>
      <Words
        text="Your agent sets the job at the top of a markdown file."
        at={0.3}
        exit={7.6}
        style={{ left: X, top: 110 }}
      />
      <Words
        text="The work goes in a log below it."
        at={8.2}
        exit={16.55}
        style={{ left: X, top: 110 }}
      />
      <div
        style={{
          position: 'absolute',
          left: X,
          top: 236,
          width: WIDTH,
          border: `1px solid ${c.lineStrong}`,
          borderRadius: 14,
          background: c.page,
          overflow: 'hidden',
          ...card,
          opacity: Number(card.opacity) * (1 - ramp(t, 16.55, 0.4)),
        }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: '0 28px',
            background: c.sunk,
            borderBottom: `1px solid ${c.line}`,
            fontFamily: font.mono,
            fontSize: 22,
            color: c.ink,
          }}
        >
          queue.md
        </div>
        <div
          style={{
            boxSizing: 'border-box',
            height: 26 + 6 * 39 + 14,
            padding: '26px 28px 14px',
            fontFamily: font.mono,
            fontSize: 26,
            lineHeight: '39px',
          }}
        >
          <Source text={typed(body.trimEnd(), t, BODY_AT, 60)} />
        </div>
        <div style={{ height: mix(0, 32, ramp(t, 9.4, 0.5)) + grown * 44 }}>
          <div
            style={{
              height: 1,
              marginTop: 6,
              background: c.line,
              width: `${ramp(t, 9.4, 0.7) * 100}%`,
            }}
          />
          <div style={{ padding: '12px 28px 0' }}>
            {rows.map((e, i) => (
              <LogRow key={e.seq} entry={e} style={lift(t, LOG_AT[i] ?? 0)} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
