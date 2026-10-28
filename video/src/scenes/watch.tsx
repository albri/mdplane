import { deriveTasks, type Entry, type TaskView } from '@mdplane/contract/core'
import { interpolate, interpolateColors } from 'remotion'
import { arrive, fade, lift, mix, ramp, travel, useT, Words } from '../motion.tsx'
import { EDITED, editOf, type FilmSession } from '../session.ts'
import { c, font, WIDTH, X } from '../theme.ts'
import { Chip } from './claims.tsx'
import { TYPE_COLOUR } from './job.tsx'
import { KEY } from './link.tsx'

const time = (iso: string) => iso.slice(11, 16)

const STATUS: Record<TaskView['status'], [string, string]> = {
  open: ['Open', c.ink2],
  claimed: ['In progress', c.warn],
  done: ['Done', c.ok],
  cancelled: ['Cancelled', c.ink3],
}

// Where the reader's timeline is, as a fractional entry number: it plays live, then is dragged back.
const LIVE_FROM = 1.2
const STEP = 0.4
const SCRUB = [6.9, 8.2] as const
function position(t: number, last: number) {
  const live = Math.min(last, 9 + Math.max(0, (t - LIVE_FROM) / STEP))
  const whole = Math.floor(live)
  const glide = whole + arrive(live - whole)
  return mix(glide, 12, ramp(t, SCRUB[0], SCRUB[1] - SCRUB[0], travel))
}

function Reader({ entries, t }: { entries: Entry[]; t: number }) {
  const pos = position(t, entries.length)
  const n = Math.round(pos)
  const seen = entries.slice(0, n)
  const head = seen.at(-1)
  const tasks = head ? deriveTasks(seen, Date.parse(head.at)) : []
  const live = 1 - ramp(t, SCRUB[0] - 0.2, 0.3)
  const history = seen.slice(-6)
  const TRACK = { x: 104, w: 1080 }
  const at = (seq: number) => TRACK.x + ((seq - 1) / (entries.length - 1)) * TRACK.w
  return (
    <div
      style={{
        position: 'absolute',
        left: X,
        top: 240,
        width: WIDTH,
        height: 652,
        border: `1px solid ${c.lineStrong}`,
        borderRadius: 14,
        background: c.page,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '68px 1fr 80px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <span
          style={{
            padding: '3px 12px',
            borderRadius: 6,
            background: c.sunk2,
            fontFamily: font.sans,
            fontWeight: 600,
            fontSize: 20,
            color: c.ink2,
          }}
        >
          Read
        </span>
        <span style={{ fontFamily: font.mono, fontSize: 22, color: c.ink3 }}>
          mdplane.dev/r/<span style={{ color: c.ink }}>{KEY}</span>
        </span>
        <span style={{ marginLeft: 'auto', position: 'relative', width: 120, height: 34 }}>
          <span style={{ position: 'absolute', right: 0, opacity: live }}>
            <Chip colour={c.ok}>Live</Chip>
          </span>
          <span
            style={{
              position: 'absolute',
              right: 0,
              opacity: 1 - live,
              padding: '1px 14px',
              border: `1.5px dashed ${c.lineStrong}`,
              borderRadius: 999,
              fontFamily: font.sans,
              fontWeight: 500,
              fontSize: 21,
              color: c.ink2,
            }}
          >
            Replay
          </span>
        </span>
        <span
          style={{
            padding: '2px 14px',
            border: `1.5px solid ${c.ok}`,
            borderRadius: 8,
            fontFamily: font.sans,
            fontWeight: 500,
            fontSize: 21,
            color: c.ok,
          }}
        >
          ✓ Verified
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 560px', minHeight: 0 }}>
        <div style={{ padding: '16px 28px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: font.sans,
              fontSize: 21,
              marginBottom: 6,
            }}
          >
            <b style={{ fontWeight: 600, color: c.ink }}>Tasks</b>
            <span style={{ color: c.ink3 }}>
              {tasks.length} tasks · {tasks.filter((x) => x.status === 'done').length} done
            </span>
          </div>
          {tasks.map((task) => {
            const [label, colour] = STATUS[task.status]
            return (
              <div
                key={task.seq}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '54px 1fr auto',
                  alignItems: 'baseline',
                  padding: '14px 0 13px',
                  borderTop: `1px solid ${c.line}`,
                }}
              >
                <span style={{ fontFamily: font.mono, fontSize: 21, color: c.ink3 }}>
                  #{task.seq}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: font.sans,
                      fontWeight: 600,
                      fontSize: 24,
                      color: c.ink,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {task.body}
                  </div>
                  <div style={{ marginTop: 3, fontFamily: font.sans, fontSize: 19, color: c.ink3 }}>
                    {task.author} · {time(task.createdAt)}
                    {task.holder && task.leaseExpiresAt
                      ? ` · ${task.holder} holds it until ${time(task.leaseExpiresAt)}`
                      : ''}
                  </div>
                </div>
                <Chip colour={colour}>{label}</Chip>
              </div>
            )
          })}
        </div>
        <div
          style={{
            borderLeft: `1px solid ${c.line}`,
            background: c.page,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '16px 24px 10px',
              fontFamily: font.sans,
              fontSize: 21,
            }}
          >
            <b style={{ fontWeight: 600, color: c.ink }}>History</b>
            <span style={{ fontFamily: font.mono, fontSize: 19, color: c.ink3 }}>
              {n} of {entries.length}
            </span>
          </div>
          {history.map((e) => {
            const isHead = e.seq === n
            return (
              <div
                key={e.seq}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr auto',
                  columnGap: 6,
                  padding: '9px 24px 10px',
                  borderTop: `1px solid ${c.line}`,
                  background: isHead ? c.actionTint : c.page,
                  fontFamily: font.sans,
                  fontSize: 19,
                }}
              >
                <span style={{ fontFamily: font.mono, color: isHead ? c.action : c.ink3 }}>
                  #{e.seq}
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ fontFamily: font.mono, color: TYPE_COLOUR[e.type] }}>
                    {e.type}
                  </span>{' '}
                  <span style={{ color: c.ink }}>{e.author}</span>
                  {e.ref === null ? '' : <span style={{ color: c.ink3 }}> → #{e.ref}</span>}
                </span>
                <span style={{ fontFamily: font.mono, color: c.ink3 }}>{time(e.at)}</span>
                <span
                  style={{
                    gridColumn: '2 / 4',
                    color: c.ink2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {e.type === 'write' ? `Body version ${e.version ?? 1}` : e.body}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ position: 'relative', borderTop: `1px solid ${c.line}` }}>
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 18,
            width: 44,
            height: 44,
            borderRadius: 10,
            background: c.ink,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: '9px solid transparent',
              borderBottom: '9px solid transparent',
              borderLeft: `14px solid ${c.page}`,
              marginLeft: 4,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: TRACK.x,
            top: 39,
            width: TRACK.w,
            height: 2,
            background: c.line,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: TRACK.x,
            top: 38,
            width: at(pos) - TRACK.x,
            height: 4,
            background: c.action,
          }}
        />
        {entries.map((e) => (
          <div
            key={e.seq}
            style={{
              position: 'absolute',
              left: at(e.seq) - 1,
              top: 31,
              width: 2,
              height: 18,
              background: e.seq <= pos ? c.ink : c.lineStrong,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: at(pos) - 13,
            top: 27,
            width: 26,
            height: 26,
            boxSizing: 'border-box',
            borderRadius: '50%',
            border: `4px solid ${c.action}`,
            background: c.page,
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: 28,
            top: 26,
            fontFamily: font.mono,
            fontSize: 21,
            color: c.ink2,
          }}
        >
          #{n} of {entries.length} · {head ? time(head.at) : ''}
        </span>
      </div>
    </div>
  )
}

const CHAIN = [13, 14, 15, 16, 17]
const BLOCK = 272
const GUTTER = (WIDTH - CHAIN.length * BLOCK) / (CHAIN.length - 1)
const EDIT_AT = 12.1
const CHECK_AT = (i: number) => 13.3 + i * 0.6

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
                  opacity: fade(t, 10.4 + i * 0.12),
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
                ...lift(t, 10.2 + i * 0.12, 16),
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

// 0–19s. The reader fills live and is dragged back; then an edit to #15 breaks the chain.
export function Watch({ session }: { session: FilmSession }) {
  const t = useT()
  const reader = fade(t, 0.4, 9.6)
  return (
    <>
      <Words
        text="Watch the work arrive, and replay any moment."
        at={0.3}
        exit={9.5}
        style={{ left: X, top: 110 }}
      />
      <Words
        text={'Edit an old entry, and every\nfingerprint after it breaks.'}
        at={9.9}
        exit={15.5}
        style={{ left: X, top: 110 }}
      />
      <Words
        text={'Anyone who kept a later\nfingerprint can tell.'}
        at={15.8}
        exit={18.6}
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
        <Reader entries={session.entries} t={t} />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - ramp(t, 18.6, 0.4, travel) }}>
        <Chain entries={session.entries} rehashed={session.rehashed} t={t} />
      </div>
    </>
  )
}
