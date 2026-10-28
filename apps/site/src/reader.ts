import { type Entry, verifyChain } from '@mdplane/contract/core'
import { $, $$, $as, clock, esc, motionOK, revealIn } from './dom.ts'
import { markdown } from './markdown.ts'
import {
  agentView,
  countTasks,
  leaseEnd,
  minutesLeft,
  type Session,
  type State,
  stateAt,
  summary,
  type Thread,
} from './model.ts'

const ICON = {
  back: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 3h1.6v10H3.5zM13 3.3v9.4L6.2 8z" fill="currentColor"/></svg>',
  fwd: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10.9 3h1.6v10h-1.6zM3 3.3v9.4L9.8 8z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  pause:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>',
}

const TIER = {
  r: ['Read', 'Read: view, search and watch'],
  a: ['Append', 'Append: read and add to the log'],
  w: ['Write', 'Write: everything, including bodies and links'],
} as const

const INFO = `
  <aside class="rd-info" aria-label="Workspace">
    <dl class="kv">
      <div><dt>Workspace</dt><dd data-i="name"></dd></div>
      <div><dt>File</dt><dd class="mono" data-i="file"></dd></div>
      <div><dt>Your link</dt><dd data-i="tier"></dd></div>
      <div><dt>Showing</dt><dd data-i="at"></dd></div>
      <div data-i="expiry-row" hidden><dt>Deletes itself</dt><dd data-i="expiry"></dd></div>
    </dl>
    <div class="info-block"><h4>Tasks at this point</h4><ul class="counts" data-i="counts"></ul></div>
    <div class="info-block"><h4>Who has written so far</h4><ul class="people" data-i="people"></ul></div>
    <div class="info-block">
      <h4>History</h4>
      <p class="info-hash" data-i="head"></p>
      <button type="button" class="btn btn-quiet btn-sm" data-act="verify">Check the chain</button>
      <p class="verify-out" data-i="verify" aria-live="polite"></p>
    </div>
  </aside>`

type Verified = Awaited<ReturnType<typeof verifyChain>> & { count: number }
type VerifyState = Verified | { pending: true } | { unsupported: true } | null

let readers = 0

type Elements = Record<
  'url' | 'flag' | 'verify' | 'doc' | 'log' | 'count' | 'list' | 'fill' | 'ticks' | 'pos',
  HTMLElement
>

export class Reader {
  readonly root: HTMLElement
  readonly compact: boolean
  touched = false
  session: Session | null = null
  pos = 0
  private view: 'rendered' | 'source' = 'rendered'
  private timer: number | null = null
  private ticks = 0
  private state: State | null = null
  private readonly el: Elements
  private readonly range: HTMLInputElement
  private readonly info: HTMLElement | null

  constructor(root: HTMLElement, { compact = false } = {}) {
    readers += 1
    this.root = root
    this.compact = compact
    root.classList.add('reader', compact ? 'is-compact' : 'is-full')
    root.innerHTML = this.template(`r${readers}`)
    const pick = (name: string) => $(`[data-el="${name}"]`, root)
    this.el = {
      url: pick('url'),
      flag: pick('flag'),
      verify: pick('verify'),
      doc: pick('doc'),
      log: pick('log'),
      count: pick('count'),
      list: pick('list'),
      fill: pick('fill'),
      ticks: pick('ticks'),
      pos: pick('pos'),
    }
    this.range = $as(HTMLInputElement, '[data-el="range"]', root)
    this.info = root.querySelector('.rd-info')

    root.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      if (!button || !root.contains(button)) return
      const { view, act, index } = button.dataset
      if (view === 'rendered' || view === 'source') this.setView(view)
      else if (act === 'play') this.toggle()
      else if (act === 'back') this.step(-1)
      else if (act === 'fwd') this.step(1)
      else if (act === 'latest') {
        this.interact()
        this.setPos(this.head)
      } else if (act === 'verify') void this.verify()
      else if (index) {
        this.interact()
        this.setPos(Number(index))
      }
    })
    this.range.addEventListener('input', () => {
      this.interact()
      this.setPos(Number(this.range.value), { animate: false })
    })
    if (compact) {
      root.addEventListener('keydown', (event) => {
        const target = event.target
        if (!(target instanceof HTMLElement) || target === this.range || target.closest('.seg'))
          return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          this.step(event.key === 'ArrowLeft' ? -1 : 1)
        }
      })
    }
  }

  private template(id: string): string {
    return `
      <div class="rd-bar">
        <span class="rd-tier" data-el="tier"></span>
        <span class="rd-url" data-el="url"></span>
        <span class="rd-flag" data-el="flag" hidden></span>
        <span class="rd-verify" data-el="verify" aria-live="polite"></span>
        <div class="seg" role="group" aria-label="View">
          <button type="button" data-view="rendered" aria-pressed="true">Rendered</button>
          <button type="button" data-view="source" aria-pressed="false">Markdown</button>
        </div>
      </div>
      <div class="rd-body">
        ${this.compact ? '' : INFO}
        <div class="rd-doc" data-el="doc"></div>
        <aside class="rd-log" data-el="log" aria-label="History">
          <div class="lg-head"><h3>History</h3><span class="lg-count" data-el="count"></span></div>
          <ol class="lg-list" data-el="list"></ol>
        </aside>
      </div>
      <div class="rd-time">
        <button type="button" class="ic" data-act="back" aria-label="Previous entry">${ICON.back}</button>
        <button type="button" class="ic ic-play" data-act="play" aria-label="Play the history">${ICON.play}</button>
        <button type="button" class="ic" data-act="fwd" aria-label="Next entry">${ICON.fwd}</button>
        <div class="rd-range">
          <div class="rd-track"><span class="rd-fill" data-el="fill"></span></div>
          <div class="rd-ticks" data-el="ticks"></div>
          <input type="range" class="rd-input" id="${id}-range" min="1" max="1" step="1" value="1" aria-label="Position in the history" data-el="range">
        </div>
        <span class="rd-pos" data-el="pos"></span>
        <button type="button" class="rd-latest" data-act="latest">Latest</button>
      </div>`
  }

  get head(): number {
    return this.session?.entries.length ?? 0
  }

  private get time() {
    return clock(this.session?.timeZone)
  }

  private get live(): boolean {
    return this.session?.mode === 'live' && this.pos === this.head
  }

  load(session: Session, { pos }: { pos?: number } = {}): void {
    this.pause()
    this.session = session
    this.pos = Math.max(1, Math.min(session.entries.length, pos ?? session.entries.length))
    this.ticks = 0
    const [tier] = TIER[session.tier]
    $('[data-el="tier"]', this.root).textContent = tier
    // The secret never goes on screen, where it could end up in a screenshot.
    this.el.url.innerHTML = `${esc(session.host)}/${session.tier}/<b>${esc(session.workspaceId)}</b>.••••••••••••`
    this.el.flag.hidden = false
    this.el.flag.textContent = session.mode === 'live' ? 'Live' : 'Replay'
    this.el.flag.classList.toggle('is-live', session.mode === 'live')
    this.setVerify(null)
    this.update()
  }

  interact(): void {
    this.touched = true
    this.pause()
  }

  step(delta: number): void {
    this.interact()
    this.setPos(this.pos + delta)
  }

  private setView(view: 'rendered' | 'source'): void {
    this.view = view
    for (const b of $$('.seg button', this.root)) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view))
    }
    this.renderDoc()
  }

  setPos(target: number, { animate = true } = {}): void {
    const next = Math.max(1, Math.min(this.head, target))
    if (next === this.pos) return
    const prev = this.pos
    const before = animate && motionOK() && this.view === 'rendered' ? this.measure() : null
    this.pos = next
    this.update(prev)
    if (animate && next > prev && next - prev <= 2) this.revealNew()
    if (before) this.slide(before)
  }

  // FLIP rather than a document view transition: a scrubber needs every click to land
  // mid-animation, and cards inside the reader's scroll area have to stay clipped by it.
  private measure(): Map<string, number> {
    const tops = new Map<string, number>()
    for (const el of $$('[data-key]', this.el.doc)) {
      tops.set(el.dataset.key ?? '', el.getBoundingClientRect().top)
    }
    return tops
  }

  private slide(before: Map<string, number>): void {
    for (const el of $$('[data-key]', this.el.doc)) {
      const top = before.get(el.dataset.key ?? '')
      if (top === undefined) continue
      const dy = top - el.getBoundingClientRect().top
      if (Math.abs(dy) < 1) continue
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration: 320,
        easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)',
      })
    }
  }

  private revealNew(): void {
    const last = $$('.is-new', this.el.doc).at(-1)
    if (!last) return
    if (this.compact) revealIn(this.el.doc, last)
    else last.scrollIntoView({ block: 'nearest', behavior: motionOK() ? 'smooth' : 'auto' })
  }

  update(prev?: number): void {
    this.renderDoc(prev)
    this.renderLog()
    this.renderTime()
    this.renderInfo()
  }

  play(): void {
    if (this.timer !== null || !this.session) return
    if (this.pos >= this.head) this.setPos(1, { animate: false })
    this.timer = window.setInterval(() => {
      if (this.pos >= this.head) this.pause()
      else this.setPos(this.pos + 1)
    }, 1150)
    this.syncPlay()
  }

  pause(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.syncPlay()
  }

  toggle(): void {
    this.touched = true
    if (this.timer === null) this.play()
    else this.pause()
  }

  private syncPlay(): void {
    const button = this.root.querySelector('[data-act="play"]')
    if (!button) return
    button.innerHTML = this.timer === null ? ICON.play : ICON.pause
    button.setAttribute('aria-label', this.timer === null ? 'Play the history' : 'Pause')
  }

  // Called after an entry is added to the session. Follows along only if the reader was at the head.
  appended(): void {
    const wasAtHead = this.pos === this.head - 1
    this.ticks = 0
    if (this.verified) this.setVerify(null)
    if (wasAtHead) this.setPos(this.head)
    else {
      this.renderLog()
      this.renderTime()
      this.renderInfo()
    }
  }

  // Called after an entry for another file is added, which only changes the workspace's chain.
  logChanged(): void {
    this.setVerify(null)
    this.renderInfo()
  }

  // Leases run out with time, so a live view at the head redraws now and then.
  refresh(): void {
    if (this.live) this.update()
  }

  private renderDoc(prev?: number): void {
    if (!this.session) return
    const state = stateAt(this.session, this.pos, this.live)
    this.state = state
    this.el.doc.innerHTML =
      this.view === 'source'
        ? `<pre class="src">${highlight(agentView(this.session, state))}</pre>`
        : this.docHTML(state, prev)
  }

  private docHTML(state: State, prev?: number): string {
    const time = this.time
    const fresh = (index: number) => prev !== undefined && index > prev && this.pos - prev <= 2
    const indexOf = new Map(this.session?.entries.map((e, i) => [e.seq, i + 1]))
    const isNew = (e: Entry) => fresh(indexOf.get(e.seq) ?? 0)
    let h = ''
    const write = state.write
    if (write) {
      const body =
        state.body === null
          ? '<p class="doc-empty">Loading this version…</p>'
          : markdown(state.body)
      h += `<section class="doc-body${isNew(write) ? ' is-new' : ''}" data-key="body">
        <p class="doc-meta">Body · version ${write.version ?? 1} · ${esc(write.author)} at ${time(write.at)}</p>
        <div class="prose">${body}</div></section>`
    } else {
      h += '<p class="doc-empty">This file was deleted at this point in its history.</p>'
    }
    h += `<div class="doc-loghead"><h3>Tasks</h3><p>${summary(state.threads)}</p></div>`
    h +=
      state.threads.length > 0
        ? `<ol class="tasks">${state.threads.map((t) => this.taskHTML(t, state, isNew)).join('')}</ol>`
        : '<p class="doc-empty">No tasks yet.</p>'
    return h
  }

  private taskHTML(thread: Thread, state: State, isNew: (e: Entry) => boolean): string {
    const time = this.time
    const { task, entry, kids, lapsed } = thread
    const chip = { open: 'Open', claimed: 'In progress', done: 'Done', cancelled: 'Cancelled' }[
      task.status
    ]
    const closer = kids.findLast((k) => k.type === 'response' || k.type === 'cancel')
    let meta = `${esc(entry.author)} · ${time(entry.at)}`
    if (task.status === 'claimed' && task.holder && task.leaseExpiresAt) {
      const until = Date.parse(task.leaseExpiresAt)
      meta += ` · ${esc(task.holder)} holds it until ${time(until)}, ${minutesLeft(until, state.now)}`
    } else if (lapsed) {
      meta += ` · ${esc(lapsed.author)}'s lease ran out at ${time(leaseEnd(lapsed))}`
    } else if (task.status === 'done' && closer) {
      meta += ` · done by ${esc(closer.author)} at ${time(closer.at)}`
    } else if (task.status === 'cancelled' && closer) {
      meta += ` · cancelled by ${esc(closer.author)}`
    }
    const threadHTML = kids
      .map((k, i) => {
        const renewed =
          k.type === 'claim' &&
          kids.slice(0, i).some((p) => p.type === 'claim' && p.author === k.author)
        const label = renewed ? 'claim · renewed' : k.type
        const lease = k.type === 'claim' ? ` · lease until ${time(leaseEnd(k))}` : ''
        const body = k.body ? `<p class="ent-body">${esc(k.body)}</p>` : ''
        return `<li class="ent ent-${k.type}${isNew(k) ? ' is-new' : ''}">
          <p class="ent-meta"><span class="ty ty-${k.type}">${label}</span> ${esc(k.author)} · ${time(k.at)}${lease}</p>
          ${body}</li>`
      })
      .join('')
    return `<li class="task is-${lapsed ? 'expired' : task.status}${isNew(entry) ? ' is-new' : ''}" data-key="t${entry.seq}">
      <div class="task-head">
        <span class="task-num">#${entry.seq}</span>
        <p class="task-text">${esc(task.body)}</p>
        <span class="chip" data-k="${task.status}">${chip}</span>
        <p class="task-meta">${meta}</p>
      </div>
      ${threadHTML ? `<ol class="thread">${threadHTML}</ol>` : ''}
    </li>`
  }

  private renderLog(): void {
    if (!this.session) return
    const time = this.time
    const list = this.el.list
    const active = document.activeElement
    const focused =
      active instanceof HTMLElement && list.contains(active) ? active.dataset.index : undefined
    list.innerHTML = this.session.entries
      .map((e, i) => {
        const index = i + 1
        const cls = index === this.pos ? ' is-current' : index > this.pos ? ' is-future' : ''
        const body =
          e.type === 'write'
            ? `Body version ${e.version}`
            : e.type === 'delete'
              ? 'Deleted the file'
              : (e.body ?? '')
        const ref = e.ref === null ? '' : ` → #${e.ref}`
        return `<li><button type="button" class="lg-row${cls}" data-index="${index}"${index === this.pos ? ' aria-current="step"' : ''}>
          <span class="lg-seq">#${e.seq}</span>
          <span class="lg-main"><span class="ty ty-${e.type}">${e.type}</span> ${esc(e.author)}${ref}</span>
          <span class="lg-time">${time(e.at)}</span>
          <span class="lg-body">${esc(body)}</span>
          <span class="lg-hash">${e.hash.slice(0, 7)}</span>
        </button></li>`
      })
      .join('')
    this.el.count.textContent = `${this.pos} of ${this.head}`
    if (focused)
      list.querySelector<HTMLElement>(`[data-index="${focused}"]`)?.focus({ preventScroll: true })
    const current = list.querySelector<HTMLElement>('.is-current')
    const headHeight = this.el.log.querySelector<HTMLElement>('.lg-head')?.offsetHeight ?? 0
    if (current) revealIn(this.el.log, current, headHeight)
  }

  private renderTime(): void {
    if (!this.session) return
    const n = this.head
    const span = Math.max(1, n - 1)
    this.range.max = String(n)
    this.range.value = String(this.pos)
    this.el.fill.style.width = `${((this.pos - 1) / span) * 100}%`
    if (this.ticks !== n) {
      this.el.ticks.replaceChildren(
        ...this.session.entries.map((e, i) => {
          const tick = document.createElement('i')
          tick.className = `t-${e.type}`
          tick.style.left = `${(i / span) * 100}%`
          return tick
        }),
      )
      this.ticks = n
    }
    for (const [i, tick] of Array.from(this.el.ticks.children).entries())
      tick.classList.toggle('on', i < this.pos)
    const entry = this.session.entries[this.pos - 1]
    const at = entry ? this.time(entry.at) : ''
    // Entry numbers count the whole workspace, so they only match the position in a one-file log.
    const seq = entry?.seq ?? 0
    const of = seq === this.pos ? ` of ${n}` : ` · ${this.pos} of ${n}`
    this.el.pos.innerHTML = `#${seq}<span class="of">${of}</span> · ${at}`
    this.range.setAttribute(
      'aria-valuetext',
      `Entry ${entry?.seq ?? 0}, ${this.pos} of ${n}, ${at}`,
    )
    for (const act of ['back', 'fwd', 'latest']) {
      const button = this.root.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)
      if (button) button.disabled = act === 'back' ? this.pos <= 1 : this.pos >= n
    }
  }

  private renderInfo(): void {
    const session = this.session
    const state = this.state
    if (!this.info || !session || !state) return
    const q = (key: string) => $(`[data-i="${key}"]`, this.info ?? undefined)
    q('name').textContent = session.name ?? session.workspaceId
    q('file').textContent = session.path
    q('tier').textContent = TIER[session.tier][1]
    q('at').textContent = `#${state.list.at(-1)?.seq ?? 0} · ${this.time(state.now)}`
    q('expiry-row').hidden = session.expiresAt === null
    if (session.expiresAt) q('expiry').textContent = when(session.expiresAt, session.timeZone)
    const c = countTasks(state.threads)
    q('counts').innerHTML = (
      [
        ['Done', c.done],
        ['In progress', c.claimed],
        ['Open', c.open],
        ['Cancelled', c.cancelled],
      ] as const
    )
      .map(([k, v]) => `<li><span>${k}</span><span class="n">${v}</span></li>`)
      .join('')
    const people = new Map<string, number>()
    for (const e of state.list) people.set(e.author, (people.get(e.author) ?? 0) + 1)
    q('people').innerHTML = Array.from(people)
      .map(([author, n]) => `<li><span>${esc(author)}</span><span class="n">${n}</span></li>`)
      .join('')
    const last = session.log.at(-1)
    q('head').textContent = last
      ? `${session.log.length} ${session.log.length === 1 ? 'entry' : 'entries'} in the workspace · head ${last.hash.slice(0, 12)}`
      : 'No entries yet'
  }

  private verified: Verified | null = null

  async verify(): Promise<void> {
    const session = this.session
    if (!session) return
    if (!globalThis.crypto?.subtle) {
      this.setVerify({ unsupported: true })
      return
    }
    this.setVerify({ pending: true })
    const log = [...session.log]
    const result = { ...(await verifyChain(log)), count: log.length }
    // Another entry may have arrived while hashing; this result is still about `log`.
    this.verified = result
    this.setVerify(result)
  }

  private setVerify(result: VerifyState): void {
    if (result === null) this.verified = null
    const chip = this.el.verify
    const out = this.info?.querySelector<HTMLElement>('[data-i="verify"]') ?? null
    chip.className = 'rd-verify'
    chip.removeAttribute('title')
    if (out) out.className = 'verify-out'
    if (!result || 'unsupported' in result) {
      chip.textContent = ''
      if (out) out.textContent = result ? "This browser can't run the check." : ''
      return
    }
    if ('pending' in result) {
      chip.textContent = 'Checking…'
      if (out) out.textContent = 'Checking every entry…'
      return
    }
    if (result.ok) {
      chip.textContent = '✓ History verified'
      chip.classList.add('is-ok')
      chip.title = `${result.count} entries, head ${result.head.slice(0, 7)}`
      if (out) {
        out.classList.add('ok')
        out.textContent = `All ${result.count} entries match their hashes. Checked in your browser with Web Crypto.`
      }
    } else {
      chip.textContent = `Broken at #${result.brokenAt}`
      chip.classList.add('is-bad')
      if (out) {
        out.classList.add('bad')
        out.textContent = `Entry #${result.brokenAt} doesn't match its hash.`
      }
    }
  }
}

const when = (time: string, timeZone?: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(time))

// Colours the entry types in the markdown an agent reads, after escaping it.
export function highlight(text: string): string {
  return esc(text)
    .replace(
      /^(- #\d+ \d\d:\d\d UTC )(\S+), (write|delete|task|claim|comment|response|cancel)/gm,
      '$1<span class="m">$2</span>, <span class="ty ty-$3">$3</span>',
    )
    .replace(/^(---|## .*)$/gm, '<span class="band">$1</span>')
}
