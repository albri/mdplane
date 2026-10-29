// The landing page's compact reader (apps/site/src/reader.ts and styles/reader.css), drawn at its
// CSS sizes on a 1440-wide screen and scaled to the film's width. Its tasks, their lines and the
// summary come from the reader's own model, and both panes scroll to the current entry by its rule.
import type { Entry } from '@mdplane/contract/core'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { continueRender, delayRender } from 'remotion'
import {
  leaseEnd,
  minutesLeft,
  type Session,
  stateAt,
  type State,
  summary,
  type Thread,
} from '../../../apps/site/src/model.ts'
import { arrive, mix, ramp, travel } from '../motion.tsx'
import type { FilmSession } from '../session.ts'
import { c, font, WIDTH } from '../theme.ts'

// The compact reader is 1160 wide at 1440. The film shows it shorter, to fit under a statement.
const REAL = { w: 1160, h: 500 }
const SCALE = WIDTH / REAL.w

const BAR = 47
const FOOT = 51
const PANE = REAL.h - 2 - BAR - FOOT
const LOG_W = 300
// The history's rows and the reader's scroll margin.
const ROW = 75
const LOG_HEAD = 41
const EDGE = 12
// The file pane, from the reader's CSS.
const DOC = { top: 20, bottom: 32, x: 26, w: 806 }
const PROSE = { w: 586.875, line: 23.25, gap: 10 }
const TASKS_HEAD = 41.15
const TASK_ROW = 68.25
const THREAD = { top: 4, bottom: 16, left: 42, gap: 10, meta: 19.5, line: 21 }
const ENT_W = DOC.w - THREAD.left - 1 - 14
// The reader's slide, scroll and arrival, in seconds.
const FLIP = 0.32
const SCROLL = 0.5
const ARRIVE = 1.8

const STATUS = { open: 'Open', claimed: 'In progress', done: 'Done', cancelled: 'Cancelled' }
const CHIP = { open: c.ink2, claimed: c.warn, done: c.ok, cancelled: c.ink3 }
const TYPE: Record<Entry['type'], string> = {
  task: c.ink,
  claim: c.warn,
  response: c.ok,
  comment: c.ink2,
  cancel: c.ink3,
  write: c.action,
  delete: c.ink3,
}
const TICK: Partial<Record<Entry['type'], string>> = {
  task: c.ink,
  claim: c.warn,
  response: c.ok,
  write: c.action,
}
const SHADOW_LIFT =
  '0 1px 2px color-mix(in srgb, #0b1222 6%, transparent), 0 12px 32px -16px color-mix(in srgb, #0b1222 22%, transparent)'

const time = (at: string | number) => new Date(at).toISOString().slice(11, 16)

// Where the reader is at each moment. A live step is an entry arriving; `glide` is how long the
// thumb takes to get there when it's dragged, drawn as one move that lands on the entry.
export type Step = { at: number; pos: number; head: number; live?: boolean; glide?: number }

// Lines of text as the browser would wrap them, once the film's fonts have loaded.
function useMeasure() {
  const [handle] = useState(() => delayRender('Loading fonts to measure the reader'))
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void document.fonts.ready.then(() => {
      setReady(true)
      continueRender(handle)
    })
  }, [handle])
  return useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    return (text: string, css: string, width: number) => {
      if (!ctx || !ready) return 1
      ctx.font = css
      let lines = 1
      let line = ''
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word
        if (line && ctx.measureText(next).width > width) {
          lines += 1
          line = word
        } else line = next
      }
      return lines
    }
  }, [ready])
}
type Measure = ReturnType<typeof useMeasure>

const renews = (kids: Entry[], i: number) => {
  const kid = kids[i]
  return (
    kid?.type === 'claim' &&
    kids.slice(0, i).some((k) => k.type === 'claim' && k.author === kid.author)
  )
}

// The task the current entry adds or is about, which the reader opens.
const hereOf = (entry: Entry | undefined) =>
  entry?.type === 'task' ? entry.seq : (entry?.ref ?? null)

type Frame = {
  state: State
  pos: number
  head: number
  here: number | null
  // Each task's top in the file pane, and the pane's full height.
  tops: Map<number, number>
  height: number
  // The current entry's span, and the top of the task it's in.
  target: { start: number; end: number; from: number }
}

function frameAt(session: Session, step: Step, measure: Measure): Frame {
  const state = stateAt(session, step.pos)
  const entry = state.list.at(-1)
  const here = hereOf(entry)
  const body = state.body ?? ''
  let y = DOC.top
  const bodyTop = y
  y += 16.8 + 10
  for (const block of body.trim().split('\n\n')) {
    if (block.startsWith('# ')) y += 27.5 + 8
    else if (block.startsWith('- ')) y += block.split('\n').length * PROSE.line + PROSE.gap
    else {
      const text = block.replaceAll('**', '').replaceAll('`', '')
      y += measure(text, `400 15px ${font.sans}`, PROSE.w) * PROSE.line + PROSE.gap
    }
  }
  y += 12
  let target = { start: bodyTop, end: y, from: bodyTop }
  y += TASKS_HEAD
  const tops = new Map<number, number>()
  state.threads.forEach((thread, i) => {
    const top = y
    tops.set(thread.entry.seq, top)
    y += (i === 0 ? 0 : 1) + TASK_ROW
    if (thread.entry.seq === here) {
      let ent = y + THREAD.top
      for (const [j, e] of [thread.entry, ...thread.kids].entries()) {
        const lines = j === 0 || !e.body ? 0 : measure(e.body, `400 14px ${font.sans}`, ENT_W)
        const h = THREAD.meta + lines * THREAD.line
        if (e.seq === entry?.seq) target = { start: ent, end: ent + h, from: top }
        ent += h + THREAD.gap
      }
      y = ent - THREAD.gap + THREAD.bottom
    }
  })
  return { state, pos: step.pos, head: step.head, here, tops, height: y + DOC.bottom, target }
}

// The reader's `reveal`: scroll only as far as brings the span into view, with its task if it fits.
function reveal(
  top: number,
  height: number,
  { start, end, from }: { start: number; end: number; from: number },
  inset = 0,
) {
  if (height <= PANE) return 0
  const most = height - PANE
  const at = Math.min(top, most)
  const viewTop = at + inset + EDGE
  const viewBottom = at + PANE - EDGE
  const show = (s: number, e: number) => {
    if (s < viewTop) return s - inset - EDGE
    if (e > viewBottom) return at + Math.min(e - viewBottom, s - viewTop)
    return at
  }
  const context = Math.min(from, start)
  const next = end - context <= viewBottom - viewTop ? show(context, end) : show(start, end)
  return Math.max(0, Math.min(most, next))
}

export function Reader({ film, steps, t }: { film: FilmSession; steps: Step[]; t: number }) {
  const measure = useMeasure()
  const session = useMemo<Session>(
    () => ({
      workspaceId: film.workspaceId,
      name: null,
      path: 'queue.md',
      tier: 'r',
      host: 'mdplane.dev',
      entries: film.entries,
      log: [],
      bodies: new Map(Object.entries(film.bodies)),
      mode: 'live',
      expiresAt: null,
      timeZone: 'UTC',
    }),
    [film],
  )
  const frames = useMemo(() => {
    let doc = 0
    let log = 0
    return steps.map((step) => {
      const frame = frameAt(session, step, measure)
      doc = reveal(doc, frame.height, frame.target)
      const logHeight = LOG_HEAD + step.head * ROW
      const row = LOG_HEAD + (step.pos - 1) * ROW
      log = reveal(log, logHeight, { start: row, end: row + ROW, from: row }, LOG_HEAD)
      return { ...frame, doc, log }
    })
  }, [session, steps, measure])

  const k = Math.max(
    0,
    steps.findLastIndex((s) => s.at <= t),
  )
  const now = frames[k]
  const step = steps[k]
  if (!now || !step) return null
  const before = frames[k - 1] ?? now
  const since = t - step.at
  const slide = arrive(Math.min(1, since / FLIP))
  const scroll = travel(Math.min(1, since / SCROLL))
  // A dragged thumb leaves before the reader shows where it lands.
  const next = steps[k + 1]
  const dragging = next?.glide ? ramp(t, next.at - next.glide, next.glide, travel) : 0
  const thumbPos = mix(now.pos, next?.pos ?? now.pos, dragging)
  const arrived = new Map<number, number>()
  for (const s of steps.slice(1, k + 1)) if (s.live) arrived.set(s.pos, s.at)
  const glow = (seq: number) => {
    const at = arrived.get(seq)
    if (at === undefined || t - at > ARRIVE) return {}
    const done = (t - at) / ARRIVE
    const tint = 1 - arrive(Math.max(0, (done - 0.2) / 0.8))
    return {
      opacity: arrive(Math.min(1, done / 0.2)),
      background: `color-mix(in srgb, ${c.actionTint} ${tint * 100}%, transparent)`,
      boxShadow: `0 0 0 6px color-mix(in srgb, ${c.actionTint} ${tint * 100}%, transparent)`,
    } satisfies CSSProperties
  }

  return (
    <div
      style={{
        width: REAL.w,
        height: REAL.h,
        transform: `scale(${SCALE})`,
        transformOrigin: '0 0',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateRows: `${BAR}px ${PANE}px ${FOOT}px`,
        border: `1px solid ${c.line}`,
        borderRadius: 14,
        background: c.page,
        overflow: 'hidden',
        fontFamily: font.sans,
        fontSize: 15,
        lineHeight: 1.55,
        color: c.ink,
      }}
    >
      <Bar workspaceId={film.workspaceId} />
      <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${LOG_W}px` }}>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translateY(${-mix(before.doc, now.doc, scroll)}px)`,
            }}
          >
            <Doc
              frame={now}
              top={(seq) => {
                const y = now.tops.get(seq) ?? 0
                return mix(before.tops.get(seq) ?? y, y, slide)
              }}
              glow={glow}
            />
          </div>
        </div>
        <Log frame={now} entries={session.entries} scroll={mix(before.log, now.log, scroll)} />
      </div>
      <Footer frame={now} thumb={thumbPos} />
    </div>
  )
}

// One of the bar's two view buttons.
const seg = (on: boolean, first: boolean): CSSProperties => ({
  minHeight: 28,
  padding: '3px 10px',
  boxSizing: 'border-box',
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.55,
  color: on ? c.page : c.ink2,
  background: on ? c.ink : 'transparent',
  borderLeft: first ? 0 : `1px solid ${c.lineStrong}`,
})

// The brief's inline marks: bold and code.
const inline = (text: string) =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
    part.startsWith('**') ? (
      <strong key={i} style={{ color: c.ink, fontWeight: 600 }}>
        {part.slice(2, -2)}
      </strong>
    ) : part.startsWith('`') ? (
      <code
        key={i}
        style={{
          fontFamily: font.mono,
          fontSize: 13.2,
          background: c.sunk,
          borderRadius: 4,
          padding: '1px 5px',
        }}
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  )

// One of the footer's square buttons.
const icon = (path: string, on: boolean, play = false) => (
  <span
    style={{
      flex: 'none',
      display: 'grid',
      placeItems: 'center',
      width: 34,
      height: 34,
      boxSizing: 'border-box',
      border: '1px solid transparent',
      borderRadius: 6,
      background: play ? c.ink : 'transparent',
      color: play ? c.page : on ? c.ink : c.ink3,
      opacity: on ? 1 : 0.45,
    }}
  >
    <svg viewBox="0 0 16 16" width={16} height={16}>
      <path d={path} fill="currentColor" />
    </svg>
  </span>
)

const underline: CSSProperties = {
  textDecoration: 'underline',
  textDecorationColor: c.lineStrong,
  textDecorationThickness: 1,
  textUnderlineOffset: 3,
}

// The live dot, green at the head and grey on the way back to it.
const dot = (colour: string) => (
  <i
    style={{
      width: 7,
      height: 7,
      marginRight: 6,
      borderRadius: '50%',
      background: colour,
    }}
  />
)

function Bar({ workspaceId }: { workspaceId: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 12px 8px 14px',
        borderBottom: `1px solid ${c.line}`,
      }}
    >
      <span style={{ fontFamily: font.mono, fontSize: 13, lineHeight: 1.3, color: c.ink3 }}>
        mdplane.dev/r/<span style={{ color: c.ink }}>{workspaceId}</span>.••••••••••••
      </span>
      <span
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          border: `1px solid ${c.lineStrong}`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <span style={seg(true, true)}>Rendered</span>
        <span style={seg(false, false)}>Markdown</span>
      </span>
    </div>
  )
}

const Ty = ({
  type,
  size,
  label,
}: {
  type: Entry['type']
  size: number
  label?: string | undefined
}) => (
  <span style={{ fontFamily: font.mono, fontSize: size, color: TYPE[type] }}>{label ?? type}</span>
)

function Doc({
  frame,
  top,
  glow,
}: {
  frame: Frame
  top: (seq: number) => number
  glow: (seq: number) => CSSProperties
}) {
  const { state } = frame
  const write = state.write
  const blocks = (state.body ?? '').trim().split('\n\n')
  const tasksTop = (frame.tops.values().next().value ?? 0) - TASKS_HEAD
  return (
    <div style={{ position: 'absolute', left: DOC.x, top: 0, width: DOC.w }}>
      <div style={{ position: 'absolute', top: DOC.top, width: DOC.w }}>
        <p
          style={{
            margin: '0 0 10px',
            fontFamily: font.mono,
            fontSize: 12,
            lineHeight: 1.4,
            color: c.ink3,
          }}
        >
          Body · version {write?.version ?? 1} · {write?.author} at {write ? time(write.at) : ''}
        </p>
        <div style={{ color: c.ink2 }}>
          {blocks.map((block, i) =>
            block.startsWith('# ') ? (
              <h3
                key={i}
                style={{
                  margin: '0 0 8px',
                  fontSize: 22,
                  fontWeight: 650,
                  lineHeight: 1.25,
                  letterSpacing: '-0.02em',
                  color: c.ink,
                }}
              >
                {block.slice(2)}
              </h3>
            ) : block.startsWith('- ') ? (
              <ul key={i} style={{ margin: '0 0 10px', paddingLeft: '1.2em', maxWidth: PROSE.w }}>
                {block.split('\n').map((item) => (
                  <li key={item}>{inline(item.slice(2))}</li>
                ))}
              </ul>
            ) : (
              <p key={i} style={{ margin: '0 0 10px', maxWidth: PROSE.w }}>
                {inline(block)}
              </p>
            ),
          )}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: tasksTop,
          width: DOC.w,
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '14px 0 6px',
          borderTop: `1px solid ${c.lineStrong}`,
          fontSize: 13,
        }}
      >
        <b style={{ fontWeight: 600 }}>Tasks</b>
        <span style={{ color: c.ink3 }}>{summary(state.threads)}</span>
      </div>
      {state.threads.map((thread, i) => (
        <Task
          key={thread.entry.seq}
          thread={thread}
          state={state}
          first={i === 0}
          open={thread.entry.seq === frame.here}
          current={state.list.at(-1)?.seq}
          top={top(thread.entry.seq)}
          glow={glow}
        />
      ))}
    </div>
  )
}

function Task({
  thread,
  state,
  first,
  open,
  current,
  top,
  glow,
}: {
  thread: Thread
  state: State
  first: boolean
  open: boolean
  current: number | undefined
  top: number
  glow: (seq: number) => CSSProperties
}) {
  const { task, entry, kids, lapsed } = thread
  const closer = kids.findLast((k) => k.type === 'response' || k.type === 'cancel')
  let meta = `Added by ${entry.author} at ${time(entry.at)}`
  if (task.status === 'claimed' && task.holder && task.leaseExpiresAt) {
    const until = Date.parse(task.leaseExpiresAt)
    meta = `${task.holder} holds it until ${time(until)}, ${minutesLeft(until, state.now)}`
  } else if (lapsed) {
    meta = `${lapsed.author}'s lease ran out at ${time(leaseEnd(lapsed))}`
  } else if (closer) {
    meta = `${task.status === 'done' ? 'Done' : 'Cancelled'} by ${closer.author} at ${time(closer.at)}`
  }
  const done = task.status === 'done'
  const cancelled = task.status === 'cancelled'
  const chip = CHIP[task.status]
  return (
    <div
      style={{
        position: 'absolute',
        top,
        width: DOC.w,
        borderTop: first ? 0 : `1px solid ${c.line}`,
        ...glow(entry.seq),
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '32px minmax(0, 1fr) auto 16px',
          columnGap: 10,
          rowGap: 2,
          alignItems: 'baseline',
          width: DOC.w + 20,
          boxSizing: 'border-box',
          margin: '0 -10px',
          padding: '11px 10px 12px',
          lineHeight: 1.45,
          background: open ? `color-mix(in srgb, ${c.actionTint} 65%, ${c.page})` : 'transparent',
        }}
      >
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 13,
            lineHeight: 1.6,
            color: open ? c.action : c.ink3,
          }}
        >
          #{entry.seq}
        </span>
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: open ? 'normal' : 'nowrap',
            fontWeight: cancelled ? 500 : 600,
            color: cancelled ? c.ink3 : done ? c.ink2 : c.ink,
            textDecoration: cancelled ? 'line-through' : 'none',
          }}
        >
          {task.body}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 9px',
            border: '1px solid transparent',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            color: chip,
            background: `color-mix(in srgb, ${chip} 10%, ${c.page})`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {STATUS[task.status]}
        </span>
        <svg
          viewBox="0 0 16 16"
          width={16}
          height={16}
          style={{
            gridArea: '1 / 4',
            alignSelf: 'start',
            marginTop: 3,
            color: c.ink3,
            rotate: open ? '180deg' : '0deg',
          }}
        >
          <path d="M3.4 5.4 4.5 4.3 8 7.8l3.5-3.5 1.1 1.1L8 10z" fill="currentColor" />
        </svg>
        <span
          style={{
            gridArea: '2 / 2 / auto / -1',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
            color: c.ink3,
          }}
        >
          {meta}
        </span>
      </div>
      {open ? (
        <div
          style={{
            display: 'grid',
            gap: THREAD.gap,
            margin: `${THREAD.top}px 0 ${THREAD.bottom}px ${THREAD.left}px`,
            paddingLeft: 14,
            borderLeft: `1px solid ${c.lineStrong}`,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {[entry, ...kids].map((e, j) => (
            <div key={e.seq} style={{ position: 'relative', ...(j > 0 ? glow(e.seq) : {}) }}>
              {e.seq === current ? (
                <span
                  style={{
                    position: 'absolute',
                    insetBlock: 2,
                    left: -16,
                    width: 3,
                    borderRadius: 2,
                    background: c.action,
                  }}
                />
              ) : null}
              <p
                style={{
                  margin: 0,
                  fontFamily: font.mono,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: c.ink3,
                }}
              >
                <Ty
                  type={e.type}
                  size={13}
                  label={renews(kids, j - 1) ? 'claim · renewed' : undefined}
                />{' '}
                {e.author} · {time(e.at)}
                {e.type === 'claim' ? ` · lease until ${time(leaseEnd(e))}` : ''}
              </p>
              {j > 0 && e.body ? (
                <p style={{ margin: 0, color: e.type === 'response' ? c.ink : c.ink2 }}>{e.body}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Log({ frame, entries, scroll }: { frame: Frame; entries: Entry[]; scroll: number }) {
  const ellipsis: CSSProperties = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderLeft: `1px solid ${c.line}` }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-scroll}px)` }}>
        {entries.slice(0, frame.head).map((e, i) => {
          const current = i + 1 === frame.pos
          const future = i + 1 > frame.pos
          const text =
            e.type === 'write'
              ? `Body version ${e.version ?? 1}`
              : e.type === 'delete'
                ? 'Deleted the file'
                : (e.body ?? '')
          return (
            <div
              key={e.seq}
              style={{
                position: 'absolute',
                top: LOG_HEAD + i * ROW,
                left: 0,
                right: 0,
                height: ROW,
                boxSizing: 'border-box',
                display: 'grid',
                gridTemplateColumns: '34px minmax(0, 1fr) auto',
                columnGap: 8,
                rowGap: 1,
                padding: '9px 14px',
                borderBottom: `1px solid ${c.line}`,
                background: current ? c.actionTint : 'transparent',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <span
                style={{
                  gridRow: 'span 3',
                  fontFamily: font.mono,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: current ? c.action : c.ink3,
                }}
              >
                #{e.seq}
              </span>
              <span style={{ ...ellipsis, color: future ? c.ink3 : c.ink }}>
                {future ? (
                  <span style={{ fontFamily: font.mono, fontSize: 12 }}>{e.type}</span>
                ) : (
                  <Ty type={e.type} size={12} />
                )}{' '}
                {e.author}
                {e.ref === null ? '' : ` → #${e.ref}`}
              </span>
              <span style={{ fontFamily: font.mono, fontSize: 12, lineHeight: 1.6, color: c.ink3 }}>
                {time(e.at)}
              </span>
              <span
                style={{
                  ...ellipsis,
                  gridColumn: '2 / 4',
                  fontSize: 12.48,
                  color: future ? c.ink3 : c.ink2,
                }}
              >
                {text}
              </span>
              <span
                style={{
                  gridColumn: '2 / 4',
                  fontFamily: font.mono,
                  fontSize: 11.2,
                  lineHeight: 1.5,
                  color: c.ink3,
                }}
              >
                {e.hash.slice(0, 7)}
              </span>
            </div>
          )
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: LOG_HEAD,
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          padding: '10px 14px',
          background: c.page,
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <b style={{ fontSize: 13, fontWeight: 600 }}>History</b>
        <span style={{ fontFamily: font.mono, fontSize: 12, lineHeight: 1.4, color: c.ink3 }}>
          {frame.pos} of {frame.head}
        </span>
      </div>
    </div>
  )
}

// The film's reader follows a live session, so its status is Live at the head and the way back
// to it anywhere else.
function Footer({ frame, thumb }: { frame: Frame; thumb: number }) {
  const { pos, head } = frame
  const entry = frame.state.list.at(-1)
  const progress = head > 1 ? (thumb - 1) / (head - 1) : 1
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 12px',
        borderTop: `1px solid ${c.line}`,
        background: c.page,
      }}
    >
      {icon('M3.5 3h1.6v10H3.5zM13 3.3v9.4L6.2 8z', pos > 1)}
      {icon('M4.5 2.8v10.4L13 8z', true, true)}
      {icon('M10.9 3h1.6v10h-1.6zM3 3.3v9.4L9.8 8z', pos < head)}
      <div style={{ position: 'relative', flex: 1, height: 34, margin: '0 8px' }}>
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: '50%',
            height: 2,
            marginTop: -1,
            borderRadius: 1,
            background: c.line,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: c.action,
              transformOrigin: 'left',
              scale: `${progress} 1`,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: '0 7px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {frame.state.list.length > 0
            ? Array.from({ length: head }, (_, i) => {
                const on = i < pos
                const type = frame.state.list[i]?.type
                return (
                  <i
                    key={i}
                    style={{
                      width: 2,
                      height: 10,
                      borderRadius: 1,
                      background: on ? ((type && TICK[type]) ?? c.ink3) : c.lineStrong,
                    }}
                  />
                )
              })
            : null}
        </div>
        <span
          style={{
            position: 'absolute',
            top: 9,
            left: `calc(8px + (100% - 16px) * ${progress})`,
            width: 16,
            height: 16,
            marginLeft: -8,
            boxSizing: 'border-box',
            borderRadius: '50%',
            background: c.page,
            border: `2px solid ${c.action}`,
            boxShadow: SHADOW_LIFT,
          }}
        />
      </div>
      <p
        style={{
          flex: 'none',
          minWidth: '17ch',
          margin: 0,
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontFamily: font.mono,
          fontSize: 12,
          lineHeight: 1.4,
          color: c.ink2,
        }}
      >
        #{entry?.seq} of {head} · {entry ? time(entry.at) : ''}
      </p>
      <p
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          margin: '0 0 0 14px',
          fontSize: 13,
          lineHeight: 1.4,
          color: c.ink2,
          whiteSpace: 'nowrap',
        }}
      >
        {pos < head ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', ...underline }}>
            {dot(c.ink3)}Back to live
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>{dot(c.ok)}Live</span>
        )}
        <span style={underline}>✓ Checked</span>
      </p>
    </div>
  )
}
