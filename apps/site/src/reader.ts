// The reader: one file's body, its tasks as threads and its history, at any point on a timeline.
// Everything renders through lit-html, so text from the log is escaped by construction.
import { type Entry, GENESIS, type LogItem, verifyChain } from '@mdplane/contract/core'
import { html, nothing, render, type TemplateResult } from 'lit-html'
import { classMap } from 'lit-html/directives/class-map.js'
import { guard } from 'lit-html/directives/guard.js'
import { createRef, ref } from 'lit-html/directives/ref.js'
import {
  $$,
  clock,
  cssProps,
  dateTime,
  heading,
  motionOK,
  ownsKeys,
  reveal,
  scrollBehavior,
} from './dom.ts'
import { departure, recall, remember } from './heads.ts'
import { markdown } from './markdown.ts'
import {
  agentView,
  countTasks,
  describe,
  leaseEnd,
  type LiveStatus,
  minutesLeft,
  type Session,
  type State,
  stateAt,
  summary,
  type Thread,
} from './model.ts'

const icon = (path: string) =>
  html`<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d=${path} fill="currentColor" />
  </svg>`

const ICONS = {
  back: icon('M3.5 3h1.6v10H3.5zM13 3.3v9.4L6.2 8z'),
  forward: icon('M10.9 3h1.6v10h-1.6zM3 3.3v9.4L9.8 8z'),
  play: icon('M4.5 2.8v10.4L13 8z'),
  pause: icon('M4 3h3v10H4zM9 3h3v10H9z'),
  close: icon(
    'M4.3 3.2 8 6.9l3.7-3.7 1.1 1.1L9.1 8l3.7 3.7-1.1 1.1L8 9.1l-3.7 3.7-1.1-1.1L6.9 8 3.2 4.3z',
  ),
  more: icon('M3.4 5.4 4.5 4.3 8 7.8l3.5-3.5 1.1 1.1L8 10z'),
}

const TIERS = {
  r: 'Read: view, search and watch',
  a: 'Append: read and add to the log',
  w: 'Write: everything, including bodies and links',
} as const

const STATUS = { open: 'Open', claimed: 'In progress', done: 'Done', cancelled: 'Cancelled' }

// Playing waits on each entry long enough to read it: a beat, then time for its words.
const dwell = (entry: Entry | undefined) =>
  Math.min(5000, Math.max(2200, 1400 + (entry?.body?.length ?? 0) * 30))
const FLIP = { duration: 320, easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)' }
// Past this, the timeline's ticks would merge into a bar.
const MAX_TICKS = 240
// A history this long or shorter draws every row, so the browser can find any of them.
const ALL_ROWS = 100
// Past that, rows are drawn this far beyond each edge of the screen, so scrolling meets rows that
// are already there.
const OVERSCAN = 4
// The file shows the tasks and comments with an entry among this many of its latest, and more on
// request. A log can hold 10,000 entries, which would be far too many to draw at every step.
const DOC_DEPTH = 40
// Entries the history check takes at a time. On a phone, 500 take about 20 ms.
const CHECK_SLICE = 500

const LIVE = {
  connecting: ['Connecting…', 'Connecting to the live stream'],
  live: ['Live', 'New entries appear as they are added'],
  reconnecting: ['Reconnecting…', 'Lost the live stream. Reconnecting'],
  ended: ['Ended', 'This link has stopped working, so nothing new will arrive'],
} as const

type Verification =
  | { state: 'idle' | 'checking' | 'unsupported' }
  | { state: 'ok'; count: number; head: string }
  | { state: 'broken'; at: number }
  // The chain matches itself but no longer leads to a head this browser checked before.
  | { state: 'changed'; at: number }

type Move = {
  behavior: ScrollBehavior
  // Say the new position in the live region. Controls that announce themselves don't need it.
  announce?: boolean
  // Slide cards to their new places and flash new entries. Off while scrubbing.
  animate?: boolean
}

export type ReaderOptions = {
  variant?: 'compact' | 'full'
  // The level of the reader's own headings. A file body's top heading takes it too.
  level?: number
  // Where the toolbar renders, when the page puts it in its own header.
  bar?: HTMLElement
}

let readers = 0

export class Reader {
  readonly root: HTMLElement
  readonly variant: 'compact' | 'full'
  // Set once someone uses the controls, so the page stops driving the reader itself.
  touched = false
  session: Session | null = null
  pos = 0
  private readonly id = `rd${++readers}`
  private readonly level: number
  private readonly bar: HTMLElement | null
  private time = clock()
  private view: 'rendered' | 'source' = 'rendered'
  private pane: 'doc' | 'log' = 'doc'
  private timer: number | null = null
  private status: LiveStatus = 'connecting'
  private state: State | null = null
  // Drawing waits for the next frame, so a burst of slider input or live entries draws once.
  private frame: number | null = null
  private pending: {
    reveal: ScrollBehavior | null
    flip: Map<string, number> | null
    focusRow: boolean
  } = { reveal: null, flip: null, focusRow: false }
  // The history rows' height, which CSS sets: this at the default text size, and measured from a
  // drawn row in case the text size is different. Only which rows to draw depends on it.
  private rowHeight = 76
  private rowsFitted = false
  private rowsDrawn = new Set<number>()
  private docDepth = DOC_DEPTH
  private arrived = new Set<number>()
  private flips: Animation[] = []
  private announcement = ''
  private verification: Verification = { state: 'idle' }
  // The run of the log already checked, so new entries can be checked on their own.
  private checked: { log: LogItem[] | null; count: number; head: string } = {
    log: null,
    count: 0,
    head: GENESIS,
  }
  private checks = 0
  // Where a live workspace's history parted from the head this browser remembered, once found.
  private changedAt: number | null = null
  // Tasks open because someone opened them. The task the current entry belongs to opens on its
  // own, unless it was closed since the reader moved there.
  private opened = new Set<number>()
  private shut: number | null = null
  // The compact reader has no details panel, so its chain details open above the footer.
  private chainOpen = false
  private readonly doc = createRef<HTMLElement>()
  private readonly log = createRef<HTMLElement>()
  // The history's panel draws the rows it lacks when it appears or changes size.
  private readonly logSized = new ResizeObserver(() => this.onLogScroll())
  private logWatched: HTMLElement | null = null

  constructor(root: HTMLElement, { variant = 'compact', level = 3, bar }: ReaderOptions = {}) {
    this.root = root
    this.variant = variant
    this.level = level
    this.bar = bar ?? null
    root.classList.add('reader', `is-${variant}`)
    root.addEventListener('keydown', this.onKey)
    // Wide screens show the details as a column, which would leave an open popover floating.
    if (variant === 'full') {
      window.matchMedia('(min-width: 1200px)').addEventListener('change', (event) => {
        const open = root.querySelector('.rd-info:popover-open')
        if (event.matches && open instanceof HTMLElement) open.hidePopover()
      })
    }
  }

  get head(): number {
    return this.session?.entries.length ?? 0
  }

  get playing(): boolean {
    return this.timer !== null
  }

  private get entry(): Entry | undefined {
    return this.session?.entries[this.pos - 1]
  }

  private get live(): boolean {
    return this.session?.mode === 'live' && this.pos === this.head
  }

  // The task the current entry adds or is about.
  private get here(): number | null {
    const entry = this.entry
    return entry?.type === 'task' ? entry.seq : (entry?.ref ?? null)
  }

  private isOpen(task: number): boolean {
    return this.opened.has(task) || (task === this.here && this.shut !== task)
  }

  load(session: Session, { pos }: { pos?: number } = {}): void {
    this.pause()
    this.session = session
    this.time = clock(session.timeZone)
    this.pos = Math.max(1, Math.min(session.entries.length, pos ?? session.entries.length))
    this.arrived = new Set()
    this.verification = { state: 'idle' }
    this.changedAt = null
    this.opened = new Set()
    this.shut = null
    this.docDepth = DOC_DEPTH
    // Cards measured in the last file have nothing to slide from in this one.
    this.pending = { reveal: 'instant', flip: null, focusRow: false }
    this.draw()
    void this.verify()
  }

  step(delta: number): void {
    this.interact()
    this.move(this.pos + delta, { behavior: scrollBehavior(), announce: true, animate: true })
  }

  play(): void {
    if (this.playing || !this.session) return
    if (this.pos >= this.head) this.move(1, { behavior: 'instant' })
    this.next()
    this.draw()
  }

  private next(): void {
    this.timer = window.setTimeout(() => {
      if (this.pos >= this.head) {
        this.pause()
        return
      }
      this.move(this.pos + 1, { behavior: scrollBehavior(), animate: true })
      this.next()
    }, dwell(this.entry))
  }

  pause(): void {
    if (!this.playing) return
    window.clearTimeout(this.timer ?? undefined)
    this.timer = null
    this.draw()
  }

  toggle(): void {
    this.touched = true
    if (this.playing) this.pause()
    else this.play()
  }

  // An entry was added to this file. Follow it only if the reader was at the head.
  appended({ animate = true }: { animate?: boolean } = {}): void {
    const entry = this.session?.entries.at(-1)
    if (this.pos === this.head - 1 && entry) {
      this.announcement = `New entry: ${describe(entry)}.`
      this.move(this.head, { behavior: animate ? scrollBehavior() : 'instant', animate })
    } else {
      this.draw()
    }
    void this.verify()
  }

  // How the live stream is doing. Losing it, getting it back and its end are said aloud too.
  connection(status: LiveStatus): void {
    const was = this.status
    if (status === was) return
    this.status = status
    if (this.session?.mode === 'live') {
      if (status === 'ended') this.announcement = `${LIVE.ended[1]}.`
      else if (status === 'reconnecting' && was === 'live')
        this.announcement = `${LIVE.reconnecting[1]}.`
      else if (status === 'live' && was === 'reconnecting') this.announcement = 'Live again.'
    }
    this.draw()
  }

  // A body arrived or failed, which matters only if the version on screen was waiting for one.
  bodiesChanged(): void {
    if (this.state?.write && this.state.body === null) this.draw()
  }

  // An entry was added to another file, which only extends the workspace's chain.
  logChanged(): void {
    this.draw()
    void this.verify()
  }

  // Leases run out with time, so a live view at the head redraws now and then.
  refresh(): void {
    if (this.live) this.draw()
  }

  // Checks only the entries that arrived since the last check, unless asked to start over.
  async verify({ full = false, announce = false } = {}): Promise<void> {
    const log = this.session?.log
    if (!log) return
    if (!globalThis.crypto?.subtle) {
      this.setVerification({ state: 'unsupported' })
      return
    }
    if (full || this.checked.log !== log) this.checked = { log, count: 0, head: GENESIS }
    const check = ++this.checks
    if (this.checked.count === 0) this.setVerification({ state: 'checking' })
    // A slice at a time, each after a frame has been drawn, so checking a long log neither holds
    // up the first frame nor blocks input for long.
    while (this.checked.count < log.length) {
      // oxlint-disable-next-line no-await-in-loop -- the point is to let the page run in between
      await afterPaint()
      // A later check carries on from the same place, so its answer covers this one.
      if (check !== this.checks) return
      const { count, head } = this.checked
      const items = log.slice(count, count + CHECK_SLICE)
      // oxlint-disable-next-line no-await-in-loop -- each slice starts from the last one's head
      const result = await verifyChain(items, head)
      if (!result.ok) {
        if (check !== this.checks) return
        this.setVerification({ state: 'broken', at: result.brokenAt })
        if (announce) this.say(this.verifyText)
        return
      }
      // Kept even when a later check has started, since that one continues from here.
      if (this.checked.log === log && this.checked.count === count) {
        this.checked = { log, count: count + items.length, head: result.head }
      }
    }
    if (check !== this.checks) return
    this.compareWithMemory(log)
    if (this.changedAt === null) {
      this.setVerification({ state: 'ok', count: this.checked.count, head: this.checked.head })
    } else {
      this.setVerification({ state: 'changed', at: this.changedAt })
    }
    if (announce) this.say(this.verifyText)
  }

  // A live workspace's chain is also compared with the head this browser verified last time, and
  // that head moves on only while the two agree. Once they part, the warning stays.
  private compareWithMemory(log: LogItem[]): void {
    const session = this.session
    const last = log.at(-1)
    if (session?.mode !== 'live' || !last) return
    this.changedAt ??= departure(log, recall(session.workspaceId))
    if (this.changedAt === null) remember(session.workspaceId, { seq: last.seq, hash: last.hash })
  }

  // Arrow keys step through the history and Space plays it, unless a control has a use for them.
  // Space only counts with nothing focused, so it still scrolls a focused panel and presses a
  // focused button. Pages listen on the document for it; the landing page leaves Space alone.
  readonly onKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
    if (ownsKeys(event.target)) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      this.step(event.key === 'ArrowLeft' ? -1 : 1)
    } else if (event.key === ' ' && event.target === document.body) {
      event.preventDefault()
      this.toggle()
    }
  }

  private interact(): void {
    this.touched = true
    this.pause()
  }

  private move(target: number, how: Move): void {
    const session = this.session
    const next = Math.max(1, Math.min(this.head, target))
    if (!session || next === this.pos) return
    const from = this.pos
    // Cards are measured once per frame, before anything moves: a second move in the same frame
    // starts from the same places.
    if (how.animate && motionOK() && this.view === 'rendered' && this.frame === null) {
      this.pending.flip = this.measure()
    }
    this.pos = next
    this.shut = null
    const entry = session.entries[next - 1]
    if (how.announce && entry) this.announcement = this.positionText(entry)
    this.arrived =
      how.animate && next > from && next - from <= 2
        ? new Set(session.entries.slice(from, next).map((e) => e.seq))
        : new Set()
    this.pending.reveal = how.behavior
    this.draw()
  }

  private say(text: string): void {
    this.announcement = text
    this.draw()
  }

  private setVerification(verification: Verification): void {
    this.verification = verification
    this.draw()
  }

  // On a phone, a view of the file shows the file, since the history pane has no views.
  private setView(view: Reader['view']): void {
    this.view = view
    this.pane = 'doc'
    this.pending.reveal = 'instant'
    this.draw()
  }

  private setPane(pane: Reader['pane']): void {
    this.pane = pane
    this.pending.reveal = 'instant'
    this.draw()
  }

  private draw(): void {
    if (!this.session || this.frame !== null) return
    this.frame = requestAnimationFrame(() => this.paint())
  }

  private paint(): void {
    this.frame = null
    const session = this.session
    if (!session) return
    this.state = stateAt(session, this.pos, this.live)
    render(this.template(session, this.state), this.root)
    if (this.bar) render(this.toolbar(session), this.bar)
    const { reveal: scroll, flip, focusRow } = this.pending
    this.pending = { reveal: null, flip: null, focusRow: false }
    if (scroll) this.reveal(scroll)
    if (flip) this.slide(flip)
    if (focusRow) {
      this.log.value?.querySelector<HTMLElement>('[aria-current]')?.focus({ preventScroll: true })
    }
    this.fitRows()
    const log = this.log.value ?? null
    if (log && log !== this.logWatched) {
      this.logWatched = log
      this.logSized.observe(log)
    }
  }

  // Which rows are on screen is worked out from their height, so it's measured once there's a
  // row to measure.
  private fitRows(): void {
    if (this.rowsFitted) return
    const row = this.log.value?.querySelector('.lg-list > li')
    const height = row instanceof HTMLElement ? row.offsetHeight : 0
    if (height === 0) return
    this.rowsFitted = true
    if (height !== this.rowHeight) {
      this.rowHeight = height
      this.draw()
    }
  }

  // Which history rows to draw: those on screen, and those around the current entry so moving to
  // it scrolls onto rows that are already there. Indexes count from 0.
  private visibleRows(count: number): number[] {
    if (count <= ALL_ROWS) {
      this.rowsDrawn = new Set(Array.from({ length: count }, (_, i) => i))
      return [...this.rowsDrawn]
    }
    // A history that isn't shown, as on a phone showing the file, needs only the current row. The
    // rest are drawn when its panel appears.
    if (this.pane === 'doc' && this.log.value?.checkVisibility() === false) {
      this.rowsDrawn = new Set([this.pos - 1])
      return [this.pos - 1]
    }
    const screen = this.onScreen()
    const span = (screen ? screen[1] - screen[0] : 12) + OVERSCAN
    const bands: Array<[number, number]> = [[this.pos - 1 - span, this.pos + span]]
    if (screen) bands.push([screen[0] - OVERSCAN, screen[1] + OVERSCAN])
    const rows = new Set<number>()
    for (const [from, to] of bands) {
      for (let i = Math.max(0, from); i < Math.min(count, to); i++) rows.add(i)
    }
    this.rowsDrawn = rows
    return [...rows].toSorted((a, b) => a - b)
  }

  // The rows the history panel shows at its current scroll, as [first, end).
  private onScreen(): [number, number] | null {
    const box = this.log.value
    const list = box?.querySelector('.lg-list')
    if (!box || !list || box.clientHeight === 0) return null
    const top = Math.floor((box.scrollTop - topIn(box, list)) / this.rowHeight)
    return [top, top + Math.ceil(box.clientHeight / this.rowHeight) + 1]
  }

  // Scrolling draws again only when it brings rows on screen that aren't drawn yet.
  private readonly onLogScroll = (): void => {
    const screen = this.onScreen()
    if (!screen) return
    for (let i = Math.max(0, screen[0]); i < Math.min(this.head, screen[1]); i++) {
      if (!this.rowsDrawn.has(i)) {
        this.draw()
        return
      }
    }
  }

  // Keeps the current entry in view in both the file and the history.
  private reveal(behavior: ScrollBehavior): void {
    const doc = this.doc.value
    const log = this.log.value
    const seq = this.entry?.seq
    if (!doc || !log || seq === undefined) return
    // A closed task shows only its row, so that's what stays in view.
    const target =
      doc.querySelector(`[data-seq="${seq}"]`) ?? doc.querySelector(`[data-task="${this.here}"]`)
    if (target) reveal(doc, target, { behavior, from: target.closest('.task') ?? target })
    const row = log.querySelector('[aria-current]')
    const head = log.querySelector('.lg-head')
    const inset = head instanceof HTMLElement ? head.offsetHeight : 0
    if (row) reveal(log, row, { behavior, inset })
  }

  // FLIP rather than a view transition: a scrubber needs every click to land mid-animation, and
  // the cards have to stay clipped by the panel that scrolls them.
  private measure(): Map<string, number> | null {
    const doc = this.doc.value
    if (!doc) return null
    for (const animation of this.flips) animation.cancel()
    this.flips = []
    return new Map($$('[data-flip]', doc).map((el) => [el.dataset.flip ?? '', topIn(doc, el)]))
  }

  private slide(before: Map<string, number>): void {
    const doc = this.doc.value
    if (!doc) return
    for (const el of $$('[data-flip]', doc)) {
      const top = before.get(el.dataset.flip ?? '')
      const dy = top === undefined ? 0 : top - topIn(doc, el)
      if (Math.abs(dy) < 1) continue
      this.flips.push(
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], FLIP),
      )
    }
  }

  private positionText(entry: Entry): string {
    return `Entry #${entry.seq}, ${this.pos} of ${this.head}, ${this.time(entry.at)}: ${describe(entry)}.`
  }

  private get verifyText(): string {
    const v = this.verification
    if (v.state === 'ok') return `History checked: all ${v.count} entries match their hashes.`
    if (v.state === 'broken') return `History broken: entry #${v.at} doesn't match its hash.`
    if (v.state === 'changed') {
      return `History changed: entry #${v.at} isn't the one this browser checked on an earlier visit.`
    }
    if (v.state === 'unsupported') return "This browser can't check the history."
    return 'Checking…'
  }

  private readonly latest = (): void => {
    this.interact()
    this.move(this.head, { behavior: scrollBehavior(), announce: true })
  }

  // Input arrives faster than frames while dragging; the draw it asks for is shared.
  private readonly onRange = (event: Event): void => {
    if (!(event.target instanceof HTMLInputElement)) return
    this.interact()
    this.move(Number(event.target.value), { behavior: 'instant' })
  }

  private readonly onVerify = (): void => {
    if (this.verification.state !== 'checking') void this.verify({ full: true, announce: true })
  }

  // The status line's check leads to the chain details: in the details panel or column for the
  // full reader, and above the footer for the compact one.
  private readonly onCheck = (event: Event): void => {
    if (this.variant === 'compact') {
      this.chainOpen = !this.chainOpen
      this.draw()
      return
    }
    const info = this.root.querySelector('.rd-info')
    const chain = this.root.querySelector('.info-chain')
    if (!(info instanceof HTMLElement) || !(chain instanceof HTMLElement)) return
    if (!info.checkVisibility()) {
      // The source makes the popover hand focus back to the button when it closes.
      const source = event.currentTarget
      info.showPopover(source instanceof HTMLElement ? { source } : undefined)
    }
    chain.focus()
  }

  private readonly onTask = (event: Event): void => {
    const row = event.currentTarget
    if (!(row instanceof HTMLElement)) return
    const task = Number(row.dataset.task)
    if (this.isOpen(task)) {
      this.opened.delete(task)
      if (task === this.here) this.shut = task
    } else {
      this.opened.add(task)
    }
    this.draw()
  }

  private readonly onRowClick = (event: Event): void => {
    const row = event.target instanceof Element ? event.target.closest('[data-index]') : null
    if (!(row instanceof HTMLElement)) return
    this.interact()
    this.move(Number(row.dataset.index), { behavior: scrollBehavior(), animate: true })
  }

  // The history is one tab stop. Arrow keys, Home and End move through it, and the reader with it.
  private readonly onRowKey = (event: KeyboardEvent): void => {
    const target = rowTarget(event.key, this.pos, this.head)
    if (target === null) return
    event.preventDefault()
    this.interact()
    this.move(target, { behavior: scrollBehavior(), animate: true })
    this.pending.focusRow = true
  }

  private template(session: Session, state: State): TemplateResult {
    const full = this.variant === 'full'
    return html`
      ${this.bar ? nothing : html`<div class="rd-bar">${this.toolbar(session)}</div>`}
      ${this.alarm()}
      <div class="rd-panes">
        <div class="seg" role="group" aria-label="Show">
          ${(['doc', 'log'] as const).map(
            (pane) =>
              html`<button
                type="button"
                aria-pressed=${String(this.pane === pane)}
                @click=${() => this.setPane(pane)}
              >
                ${pane === 'doc' ? 'File' : 'History'}
              </button>`,
          )}
        </div>
        ${this.viewSwitch()}
      </div>
      <div class="rd-body" data-pane=${this.pane}>
        ${full ? this.info(session, state) : nothing}
        <section class="rd-doc" ${ref(this.doc)} tabindex="0" aria-label=${`File ${session.path}`}>
          ${
            this.view === 'source'
              ? html`<pre class="src">${highlight(agentView(session, state))}</pre>`
              : this.file(session, state)
          }
        </section>
        <section
          class="rd-log"
          ${ref(this.log)}
          aria-labelledby=${`${this.id}-log`}
          @scroll=${this.onLogScroll}
        >
          <div class="lg-head">
            ${heading(this.level, 'History', { id: `${this.id}-log` })}
            <span class="lg-count">${this.pos} of ${this.head}</span>
          </div>
          <ol
            class="lg-list"
            ${cssProps({ '--rows': String(this.head) })}
            @click=${this.onRowClick}
            @keydown=${this.onRowKey}
          >
            ${this.visibleRows(session.entries.length).map((i) => {
              const entry = session.entries[i]
              // Rows are reused by place rather than keyed by entry, so scrubbing a long log
              // updates the rows it has instead of making new ones.
              return entry ? this.row(entry, i + 1) : nothing
            })}
          </ol>
        </section>
      </div>
      ${
        this.variant === 'compact' && this.chainOpen
          ? html`<div class="rd-chain" id=${`${this.id}-chain`}>${this.chain(session)}</div>`
          : nothing
      }
      ${this.timeline(session)}
      <p class="visually-hidden" role="status">${this.announcement}</p>
    `
  }

  // The bar says what you're looking at and how. Where you are in time, and whether the history
  // checks out, is the footer's job. The compact reader keeps its masked link up here, to show
  // that what it shows is a link; the full reader's link is in the details.
  private toolbar(session: Session): TemplateResult {
    return html`
      ${this.variant === 'compact' ? html`<span class="rd-url">${this.link(session)}</span>` : nothing}
      <div class="rd-ctl">
        ${this.viewSwitch()}
        ${
          this.variant === 'full'
            ? html`<button type="button" class="rd-details" popovertarget=${`${this.id}-info`}>
                Details
              </button>`
            : nothing
        }
      </div>
    `
  }

  private link(session: Session): TemplateResult {
    return html`${session.host}/${session.tier}/<b>${session.workspaceId}</b
      ><span aria-hidden="true">.••••••••••••</span>
      <span class="visually-hidden">, key hidden</span>`
  }

  // Drawn twice, in the bar and in the phone's tab row, and shown in one of them at a time.
  private viewSwitch(): TemplateResult {
    return html`<div class="seg rd-view" role="group" aria-label="View">
      ${(['rendered', 'source'] as const).map(
        (view) =>
          html`<button
            type="button"
            aria-pressed=${String(this.view === view)}
            @click=${() => this.setView(view)}
          >
            ${view === 'rendered' ? 'Rendered' : 'Markdown'}
          </button>`,
      )}
    </div>`
  }

  // The live stream and the history check, as quiet text. Away from the head, the first part is
  // the way back to it, as on a live video. Only trouble is coloured.
  private standing(session: Session): TemplateResult {
    const behind = this.pos < this.head
    const live = session.mode === 'live'
    const following = live && this.status === 'live'
    let state: TemplateResult | typeof nothing = nothing
    if (live && !(following && behind)) {
      state = html`<span
        class=${classMap({ 'rd-mode': true, [`is-${this.status}`]: true })}
        title=${LIVE[this.status][1]}
        ><i aria-hidden="true"></i>${LIVE[this.status][0]}</span
      >`
    } else if (!live && !behind) {
      state = html`<span class="rd-mode">Replay</span>`
    }
    return html`<p class="rd-status">
      ${
        behind
          ? html`<button type="button" class="rd-jump" @click=${this.latest}>
              ${following ? html`<i aria-hidden="true"></i>Back to live` : 'Latest'}
            </button>`
          : nothing
      }
      ${state} ${this.check()}
    </p>`
  }

  // The history check's part of the status. Once there's a result it leads to the chain.
  private check(): TemplateResult | typeof nothing {
    const v = this.verification
    let label: string
    if (v.state === 'ok') label = 'Checked'
    else if (v.state === 'broken') label = `History broken at #${v.at}`
    else if (v.state === 'changed') label = `History changed at #${v.at}`
    else if (v.state === 'unsupported') return nothing
    else return html`<span class="rd-checking">Checking…</span>`
    const bad = v.state !== 'ok'
    const compact = this.variant === 'compact'
    return html`<button
      type="button"
      class=${classMap({ 'rd-check': true, 'is-bad': bad })}
      title=${v.state === 'ok' ? `${v.count} entries, head ${v.head.slice(0, 7)}` : nothing}
      aria-label=${`${label}. Show the chain`}
      aria-expanded=${compact ? String(this.chainOpen) : nothing}
      aria-controls=${compact && this.chainOpen ? `${this.id}-chain` : nothing}
      @click=${this.onCheck}
    >
      ${bad ? '✕' : '✓'} ${label}
    </button>`
  }

  // A history that doesn't check out is the one thing the reader shouts about.
  private alarm(): TemplateResult | typeof nothing {
    const v = this.verification
    if (v.state !== 'broken' && v.state !== 'changed') return nothing
    return html`<div class="rd-alarm" role="alert">
      <p>
        <strong>History ${v.state} at #${v.at}.</strong>
        ${
          v.state === 'broken'
            ? `Entry #${v.at} doesn't match its hash, so it or an entry before it was edited.`
            : `Entry #${v.at} isn't the one this browser checked on an earlier visit, so the history was rewritten from there.`
        }
      </p>
    </div>`
  }

  // The chain's length, its head and what the check found, with a way to check it again.
  private chain(session: Session): TemplateResult {
    const last = session.log.at(-1)
    const v = this.verification
    const n = session.log.length
    return html`<p class="info-hash">
        ${last ? `${count(n)} ${n === 1 ? 'entry' : 'entries'} in the workspace · head ${last.hash.slice(0, 12)}` : 'No entries yet'}
      </p>
      <p
        class=${classMap({
          'verify-out': true,
          ok: v.state === 'ok',
          bad: v.state === 'broken' || v.state === 'changed',
        })}
      >
        ${
          v.state === 'ok'
            ? `All ${count(v.count)} entries match their hashes. Checked in your browser with Web Crypto.`
            : this.verifyText
        }
      </p>
      ${
        v.state === 'unsupported'
          ? nothing
          : html`<button
              type="button"
              class="btn btn-quiet btn-sm verify-again"
              aria-disabled=${String(v.state === 'checking' || v.state === 'idle')}
              @click=${this.onVerify}
            >
              Check again
            </button>`
      }`
  }

  private file(session: Session, state: State): TemplateResult {
    const time = this.time
    const { write, deletion } = state
    const body = write
      ? html`<section
          class=${classMap({ 'doc-body': true, ...this.marks(write) })}
          data-seq=${write.seq}
          data-flip="body"
        >
          <p class="doc-meta">
            Body · version ${write.version ?? 1} · ${write.author} at ${time(write.at)}
          </p>
          <div class="prose">${this.body(session, state, write)}</div>
        </section>`
      : html`<p
          class=${classMap({ 'doc-empty': true, ...(deletion ? this.marks(deletion) : {}) })}
          data-seq=${deletion?.seq ?? nothing}
        >
          This file was deleted at this point in its history.
        </p>`
    // Only the tasks and comments with one of the latest entries are drawn, which always includes
    // the current one. The rest are a click away.
    const cut = state.life.length > this.docDepth ? (state.life.at(-this.docDepth)?.seq ?? 0) : 0
    const threads = state.threads.filter(
      (t) => t.entry.seq >= cut || (t.kids.at(-1)?.seq ?? 0) >= cut,
    )
    const notes = state.notes.filter((e) => e.seq >= cut)
    return html`
      ${body}
      <div class="doc-loghead" data-flip="tasks">
        ${heading(this.level, 'Tasks')}
        <p>${summary(state.threads)}</p>
      </div>
      ${this.more(state.threads.length - threads.length, 'task', 'tasks')}
      ${
        threads.length > 0
          ? html`<ol class="tasks">
              ${threads.map((t) => this.task(t, state, cut))}
            </ol>`
          : state.threads.length > 0
            ? nothing
            : html`<p class="doc-empty">No tasks yet.</p>`
      }
      ${
        state.notes.length > 0
          ? html`<div class="doc-loghead" data-flip="notes">${heading(this.level, 'Comments')}</div>
              ${this.more(state.notes.length - notes.length, 'comment', 'comments')}
              <ol class="notes">
                ${notes.map(
                  (e) =>
                    html`<li
                      class=${classMap({ ent: true, [`ent-${e.type}`]: true, ...this.marks(e) })}
                      data-seq=${e.seq}
                      data-flip=${`n${e.seq}`}
                    >
                      ${this.item(e, false)}
                    </li>`,
                )}
              </ol>`
          : nothing
      }
    `
  }

  // A version's body, fetched when it's first shown unless the session carries it.
  private body(session: Session, state: State, write: Entry): unknown {
    const hash = write.contentHash ?? undefined
    if (state.body !== null) {
      const source = state.body
      return guard([hash, this.level], () => markdown(source, this.level, hash))
    }
    session.source?.want(write)
    const problem = session.source?.problem(write) ?? null
    if (!problem) return html`<p class="doc-empty">Loading this version…</p>`
    return html`<p class="doc-empty doc-problem">
      ${problem.message}
      ${
        problem.retry
          ? html`<button
              type="button"
              class="btn btn-quiet btn-sm"
              @click=${() => session.source?.retry(write)}
            >
              Try again
            </button>`
          : nothing
      }
    </p>`
  }

  // Says how many earlier tasks or comments aren't drawn, with a way to draw more of them.
  private more(hidden: number, one: string, many: string): TemplateResult | typeof nothing {
    if (hidden === 0) return nothing
    return html`<p class="doc-more">
      ${count(hidden)} earlier ${hidden === 1 ? one : many} not shown.
      <button type="button" class="btn btn-quiet btn-sm" @click=${this.showEarlier}>
        Show more
      </button>
    </p>`
  }

  private readonly showEarlier = (): void => {
    this.docDepth *= 2
    this.draw()
  }

  private marks(entry: Entry): Record<string, boolean> {
    return { 'is-current': this.isCurrent(entry), 'is-new': this.arrived.has(entry.seq) }
  }

  // One row per task: its number, title, status and who has it. The row opens on its thread, which
  // starts with the task's own entry, since the row says what it is but not who added it.
  private task({ task, entry, kids, lapsed }: Thread, state: State, cut: number): TemplateResult {
    const time = this.time
    const closer = kids.findLast((k) => k.type === 'response' || k.type === 'cancel')
    const earlier = kids.filter((k) => k.seq < cut).length
    let meta = `Added by ${entry.author} at ${time(entry.at)}`
    if (task.status === 'claimed' && task.holder && task.leaseExpiresAt) {
      const until = Date.parse(task.leaseExpiresAt)
      meta = `${task.holder} holds it until ${time(until)}, ${minutesLeft(until, state.now)}`
    } else if (lapsed) {
      meta = `${lapsed.author}'s lease ran out at ${time(leaseEnd(lapsed))}`
    } else if (closer) {
      meta = `${task.status === 'done' ? 'Done' : 'Cancelled'} by ${closer.author} at ${time(closer.at)}`
    }
    const open = this.isOpen(entry.seq)
    const id = `${this.id}-t${entry.seq}`
    return html`<li
      class=${classMap({
        task: true,
        [`is-${lapsed ? 'expired' : task.status}`]: true,
        'is-open': open,
        'is-here': entry.seq === this.here,
        'is-new': this.arrived.has(entry.seq),
      })}
      data-flip=${`t${entry.seq}`}
    >
      <button
        type="button"
        class="task-row"
        data-task=${entry.seq}
        aria-expanded=${String(open)}
        aria-controls=${open ? id : nothing}
        @click=${this.onTask}
      >
        <span class="task-num">#${entry.seq}</span>
        <span class="task-text">${task.body}</span>
        <span class="chip" data-k=${task.status}>${STATUS[task.status]}</span>
        <span class="task-meta">${meta}</span>
        ${ICONS.more}
      </button>
      ${
        open
          ? html`<ol class="thread" id=${id}>
              <li
                class=${classMap({ ent: true, 'ent-task': true, 'is-current': this.isCurrent(entry) })}
                data-seq=${entry.seq}
              >
                ${this.item(entry, false, false)}
              </li>
              ${
                earlier > 0
                  ? html`<li class="ent-more">
                      ${count(earlier)} earlier ${earlier === 1 ? 'entry' : 'entries'} not shown
                    </li>`
                  : nothing
              }
              ${kids
                .slice(earlier)
                .map(
                  (k, i) =>
                    html`<li
                      class=${classMap({ ent: true, [`ent-${k.type}`]: true, ...this.marks(k) })}
                      data-seq=${k.seq}
                    >
                      ${this.item(k, renews(kids, earlier + i))}
                    </li>`,
                )}
            </ol>`
          : nothing
      }
    </li>`
  }

  private isCurrent(entry: Entry): boolean {
    return entry.seq === this.entry?.seq
  }

  private item(e: Entry, renewed: boolean, body = true): TemplateResult {
    const time = this.time
    const lease =
      e.type === 'claim'
        ? html` · <span class="ent-lease">lease until ${time(leaseEnd(e))}</span>`
        : nothing
    return html`<p class="ent-meta">
        <span class="ty ty-${e.type}">${renewed ? 'claim · renewed' : e.type}</span>
        ${e.author} · ${time(e.at)}${lease}
      </p>
      ${body && e.body ? html`<p class="ent-body">${e.body}</p>` : nothing}`
  }

  private row(e: Entry, index: number): TemplateResult {
    const current = index === this.pos
    const about =
      e.ref === null
        ? nothing
        : html` <span aria-hidden="true">→</span
            ><span class="visually-hidden">on task</span> #${e.ref}`
    const text =
      e.type === 'write'
        ? `Body version ${e.version ?? 1}`
        : e.type === 'delete'
          ? 'Deleted the file'
          : (e.body ?? '')
    return html`<li
      ${cssProps({ '--i': String(index - 1) })}
      aria-posinset=${index}
      aria-setsize=${this.head}
    >
      <button
        type="button"
        class=${classMap({ 'lg-row': true, 'is-current': current, 'is-future': index > this.pos })}
        data-index=${index}
        tabindex=${current ? 0 : -1}
        aria-current=${current ? 'step' : nothing}
      >
        <span class="lg-seq">#${e.seq}</span>
        <span class="lg-main"
          ><span class="ty ty-${e.type}">${e.type}</span> ${e.author}${about}</span
        >
        <span class="lg-time">${this.time(e.at)}</span>
        <span class="lg-body">${text}</span>
        <span class="lg-hash" aria-hidden="true">${e.hash.slice(0, 7)}</span>
      </button>
    </li>`
  }

  private timeline(session: Session): TemplateResult {
    const n = this.head
    const entry = this.entry
    const at = entry ? this.time(entry.at) : ''
    // Entry numbers count the whole workspace, so they only match the position in a one-file log.
    const seq = entry?.seq ?? 0
    const of = seq === this.pos ? ` of ${n}` : ` · ${this.pos} of ${n}`
    const progress = n > 1 ? (this.pos - 1) / (n - 1) : 1
    return html`<div class="rd-time">
      <button
        type="button"
        class="ic rd-back"
        aria-label="Previous entry"
        aria-keyshortcuts="ArrowLeft"
        aria-disabled=${String(this.pos <= 1)}
        @click=${() => this.step(-1)}
      >
        ${ICONS.back}
      </button>
      <button
        type="button"
        class="ic ic-play"
        aria-label=${this.playing ? 'Pause' : 'Play the history'}
        aria-keyshortcuts=${this.variant === 'full' ? 'Space' : nothing}
        @click=${() => this.toggle()}
      >
        ${this.playing ? ICONS.pause : ICONS.play}
      </button>
      <button
        type="button"
        class="ic rd-fwd"
        aria-label="Next entry"
        aria-keyshortcuts="ArrowRight"
        aria-disabled=${String(this.pos >= n)}
        @click=${() => this.step(1)}
      >
        ${ICONS.forward}
      </button>
      <div class="rd-range" ${cssProps({ '--progress': String(progress) })}>
        <div class="rd-track" aria-hidden="true"></div>
        <div class="rd-ticks" aria-hidden="true">
          ${
            n <= MAX_TICKS
              ? session.entries.map(
                  (e, i) =>
                    html`<i class=${classMap({ [`t-${e.type}`]: true, on: i < this.pos })}></i>`,
                )
              : nothing
          }
        </div>
        <input
          type="range"
          class="rd-input"
          min="1"
          max=${n}
          .value=${String(this.pos)}
          aria-label="Position in the history"
          aria-valuetext=${`Entry #${seq}, ${this.pos} of ${n}, ${at}`}
          @input=${this.onRange}
        />
      </div>
      <p class="rd-pos">#${seq}<span class="of">${of}</span> · ${at}</p>
      ${this.standing(session)}
    </div>`
  }

  private info(session: Session, state: State): TemplateResult {
    const id = `${this.id}-info`
    const time = this.time
    const counts = countTasks(state.threads)
    // Body writes and deletes are signed by the write link that made them, not by a name.
    const people = new Map<string, { n: number; link: boolean }>()
    for (const e of state.list) {
      const known = people.get(e.author)
      const link = e.type === 'write' || e.type === 'delete'
      people.set(e.author, { n: (known?.n ?? 0) + 1, link: known?.link ?? link })
    }
    return html`<aside class="rd-info" id=${id} popover tabindex="0" aria-labelledby=${`${id}-h`}>
      <div class="info-head">
        ${heading(this.level, 'Workspace', { id: `${id}-h` })}
        <button
          type="button"
          class="ic info-close"
          popovertarget=${id}
          popovertargetaction="hide"
          aria-label="Close details"
        >
          ${ICONS.close}
        </button>
      </div>
      <dl class="kv">
        <div>
          <dt>Name</dt>
          <dd>${session.name ?? session.workspaceId}</dd>
        </div>
        <div>
          <dt>File</dt>
          <dd class="mono">${session.path}</dd>
        </div>
        <div>
          <dt>Your link</dt>
          <dd>
            ${TIERS[session.tier]}
            <span class="rd-url">${this.link(session)}</span>
          </dd>
        </div>
        <div>
          <dt>Showing</dt>
          <dd>#${state.list.at(-1)?.seq ?? 0} · ${time(state.now)}</dd>
        </div>
        ${
          session.expiresAt
            ? html`<div>
                <dt>Deletes itself</dt>
                <dd>${dateTime(session.timeZone)(session.expiresAt)}</dd>
              </div>`
            : nothing
        }
      </dl>
      <section class="info-block">
        ${heading(this.level + 1, 'Tasks at this point')}
        <ul class="counts">
          ${(
            [
              ['Done', counts.done],
              ['In progress', counts.claimed],
              ['Open', counts.open],
              ['Cancelled', counts.cancelled],
            ] as const
          ).map(([k, n]) => html`<li><span>${k}</span><span class="n">${n}</span></li>`)}
        </ul>
      </section>
      <section class="info-block">
        ${heading(this.level + 1, 'Who has written so far')}
        <ul class="people">
          ${Array.from(
            people,
            ([author, { n, link }]) =>
              html`<li>
                <span>${link ? html`Write link <span class="mono">${author}</span>` : author}</span
                ><span class="n">${n}</span>
              </li>`,
          )}
        </ul>
      </section>
      <section class="info-block info-keys">
        ${heading(this.level + 1, 'Keys')}
        <p><kbd>←</kbd> <kbd>→</kbd> step through the history. <kbd>Space</kbd> plays it.</p>
      </section>
      <section class="info-block info-chain" tabindex="-1" aria-labelledby=${`${id}-chain`}>
        ${heading(this.level + 1, 'Chain', { id: `${id}-chain` })} ${this.chain(session)}
      </section>
    </aside>`
  }
}

const counter = new Intl.NumberFormat('en-GB')
const count = (n: number) => counter.format(n)

// Resolves once the next frame has been drawn.
const afterPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => window.setTimeout(resolve)))

const topIn = (box: HTMLElement, el: Element) =>
  el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop

// A claim by the same author as an earlier one renews the lease rather than taking the task.
const renews = (kids: Entry[], i: number) => {
  const kid = kids[i]
  return (
    kid?.type === 'claim' &&
    kids.slice(0, i).some((k) => k.type === 'claim' && k.author === kid.author)
  )
}

function rowTarget(key: string, pos: number, head: number): number | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      return pos - 1
    case 'ArrowDown':
    case 'ArrowRight':
      return pos + 1
    case 'Home':
      return 1
    case 'End':
      return head
    default:
      return null
  }
}

const ENTRY_LINE =
  /^(- #(\d+) \d\d:\d\d UTC )(\S+), (write|delete|task|claim|comment|response|cancel)(.*)$/
const BAND = /^(---|## .*)$/

// The markdown an agent reads, with entry types coloured. Entry lines carry their sequence number,
// so the reader can keep the current one in view here too.
export function highlight(text: string): TemplateResult {
  const lines = text.split('\n').map((line, i) => {
    const br = i > 0 ? '\n' : ''
    const entry = ENTRY_LINE.exec(line)
    if (entry) {
      const [, lead, seq, author, type, rest] = entry
      // Short pieces, so the formatter keeps this on one line: whitespace matters in a <pre>.
      const who = html`<span class="m">${author}</span>`
      const kind = html`<span class="ty ty-${type}">${type}</span>`
      return html`${br}<span data-seq=${seq ?? nothing}>${lead}${who}, ${kind}${rest}</span>`
    }
    if (BAND.test(line)) return html`${br}<span class="band">${line}</span>`
    return html`${br}${line}`
  })
  return html`${lines}`
}
