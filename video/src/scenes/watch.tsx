import type { Entry } from '@mdplane/contract/core'
import { interpolate, interpolateColors } from 'remotion'
import { fade, lift, mix, ramp, travel, useT, Words } from '../motion.tsx'
import { EDITED, editOf, type FilmSession } from '../session.ts'
import { c, font, WIDTH, X } from '../theme.ts'
import { TYPE_COLOUR } from './job.tsx'
import { Reader, type Step } from './reader.tsx'

// Where the reader is. It opens at #17 on a live session, takes the next four entries as they
// arrive, then is dragged back to #12.
const STEPS: Step[] = [
  { at: 0, pos: 17, head: 17 },
  { at: 3.1, pos: 18, head: 18, live: true },
  { at: 4.7, pos: 19, head: 19, live: true },
  { at: 6.3, pos: 20, head: 20, live: true },
  { at: 7.9, pos: 21, head: 21, live: true },
  { at: 11, pos: 12, head: 21, glide: 0.8 },
]

const CHAIN = [13, 14, 15, 16, 17]
const BLOCK = 272
const GUTTER = (WIDTH - CHAIN.length * BLOCK) / (CHAIN.length - 1)
const EDIT_AT = 19.2
const CHECK_AT = (i: number) => 20.7 + i * 0.7

function Chain({
  entries,
  rehashed,
  t,
}: {
  entries: Entry[]
  rehashed: FilmSession['rehashed']
  t: number
}) {
  return (
    <div style={{ position: 'absolute', left: X, top: 360, width: WIDTH, height: 440 }}>
      {CHAIN.map((seq, i) => {
        const e = entries[seq - 1]
        if (!e) return null
        const checked = ramp(t, CHECK_AT(i), 0.35)
        const broken = seq >= EDITED
        const border = interpolateColors(checked, [0, 1], [c.lineStrong, broken ? c.bad : c.ok])
        const left = i * (BLOCK + GUTTER)
        const edit = seq === EDITED ? editOf(e.body ?? '') : null
        const linkBroken = i > 0 && CHAIN[i - 1]! >= EDITED ? ramp(t, CHECK_AT(i) - 0.3, 0.3) : 0
        return (
          <div key={seq}>
            {i > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: left - GUTTER,
                  top: 214,
                  width: GUTTER,
                  opacity: fade(t, 16.6 + i * 0.12),
                }}
              >
                <div
                  style={{
                    height: mix(2, 4, linkBroken),
                    marginTop: mix(0, -1, linkBroken),
                    background: interpolateColors(linkBroken, [0, 1], [c.lineStrong, c.bad]),
                    width: GUTTER - 8,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: -6,
                    borderTop: '7px solid transparent',
                    borderBottom: '7px solid transparent',
                    borderLeft: `9px solid ${interpolateColors(linkBroken, [0, 1], [c.lineStrong, c.bad])}`,
                  }}
                />
              </div>
            ) : null}
            <div
              style={{
                position: 'absolute',
                left,
                top: 0,
                width: BLOCK,
                height: 430,
                boxSizing: 'border-box',
                padding: '20px 20px 18px',
                border: `${mix(1.5, 2.5, checked)}px solid ${border}`,
                borderRadius: 10,
                background: broken
                  ? interpolateColors(checked, [0, 1], [c.page, '#fcf1f0'])
                  : c.page,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                ...lift(t, 16.5 + i * 0.12, 16),
              }}
            >
              <div style={{ fontFamily: font.mono, fontSize: 24 }}>
                <span style={{ color: c.ink }}>#{seq}</span>{' '}
                <span style={{ color: TYPE_COLOUR[e.type] }}>{e.type}</span>
              </div>
              <div style={{ fontFamily: font.sans, fontSize: 22, color: c.ink3 }}>{e.author}</div>
              <div
                style={{
                  height: 102,
                  overflow: 'hidden',
                  fontFamily: font.sans,
                  fontSize: 24,
                  lineHeight: '34px',
                  color: c.ink2,
                }}
              >
                {edit ? (
                  <>
                    {edit.before}
                    <span
                      style={{
                        position: 'relative',
                        color: interpolateColors(ramp(t, EDIT_AT, 0.3), [0, 1], [c.ink2, c.bad]),
                      }}
                    >
                      {edit.was}
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '52%',
                          height: 2.5,
                          width: `${ramp(t, EDIT_AT, 0.35) * 100}%`,
                          background: c.bad,
                        }}
                      />
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        verticalAlign: 'bottom',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        maxWidth: ramp(t, EDIT_AT + 0.4, 0.4) * 40,
                        marginLeft: ramp(t, EDIT_AT + 0.4, 0.2) * 3,
                        color: c.ok,
                        background: `color-mix(in srgb, ${c.ok} 12%, transparent)`,
                      }}
                    >
                      {edit.now}
                    </span>
                    {edit.after}
                  </>
                ) : (
                  e.body
                )}
              </div>
              <div
                style={{
                  marginTop: 'auto',
                  display: 'grid',
                  gap: 4,
                  fontFamily: font.mono,
                  fontSize: 22,
                  color: c.ink3,
                }}
              >
                <span>
                  prev <span style={{ color: c.ink }}>{e.prev.slice(0, 7)}</span>
                </span>
                <span>
                  hash{' '}
                  <span
                    style={{
                      position: 'relative',
                      color: broken ? interpolateColors(checked, [0, 1], [c.ink, c.ink3]) : c.ink,
                    }}
                  >
                    {e.hash.slice(0, 7)}
                    {broken ? (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '52%',
                          height: 2,
                          width: `${checked * 100}%`,
                          background: c.ink3,
                        }}
                      />
                    ) : null}
                  </span>
                </span>
                <span
                  style={{ color: c.bad, opacity: broken ? ramp(t, CHECK_AT(i) + 0.15, 0.35) : 0 }}
                >
                  now&nbsp; {(rehashed[seq] ?? '').slice(0, 7)}
                </span>
              </div>
              <div
                style={{
                  height: 28,
                  fontFamily: font.sans,
                  fontWeight: 650,
                  fontSize: 23,
                  color: broken ? c.bad : c.ok,
                  opacity: ramp(t, CHECK_AT(i) + 0.15, 0.35),
                }}
              >
                {broken ? "✕ Doesn't match" : '✓ Matches'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 0–31s. The reader fills live and is dragged back; then an edit to #15 breaks the chain.
export function Watch({ session }: { session: FilmSession }) {
  const t = useT()
  const reader = fade(t, 1.5, 14.6)
  return (
    <>
      <Words
        text="Watch the work arrive, and replay any moment."
        at={0.3}
        exit={14.6}
        style={{ left: X, top: 110 }}
      />
      <Words
        text={'Edit an old entry, and every\nfingerprint after it breaks.'}
        at={15.2}
        exit={25.6}
        style={{ left: X, top: 110 }}
      />
      <Words
        text={'Anyone who kept a later\nfingerprint can tell.'}
        at={26}
        exit={30.5}
        style={{ left: X, top: 110 }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: reader,
          transform: `translateY(${interpolate(reader, [0, 1], [18, 0])}px)`,
        }}
      >
        <div style={{ position: 'absolute', left: X, top: 226 }}>
          <Reader film={session} steps={STEPS} t={t} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ramp(t, 30.5, 0.4, travel) }}>
        <Chain entries={session.entries} rehashed={session.rehashed} t={t} />
      </div>
    </>
  )
}
