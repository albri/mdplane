// The chain demo: five entries of the sample, checked in the browser, and what happens to the
// check when one of them is edited.
import type { Entry } from '@mdplane/contract/core'
import { html, nothing, render } from 'lit-html'
import { classMap } from 'lit-html/directives/class-map.js'
import { verifyChain } from '@mdplane/contract/core'
import { $, $as, cssProps } from './dom.ts'
import type { Session } from './model.ts'

type Mark = 'ok' | 'bad' | 'after'
const MARKS: Record<Mark, string> = {
  ok: 'Matches',
  bad: "Doesn't match",
  after: 'After the break',
}
const SHOWN = [13, 14, 15, 16, 17]
const EDITED = 15

export function initChainDemo(sample: Session): void {
  const box = $('#chain')
  const out = $('#chain-out')
  const verifyButton = $as(HTMLButtonElement, '[data-chain="verify"]')
  const tamperButton = $as(HTMLButtonElement, '[data-chain="tamper"]')
  const undoButton = $as(HTMLButtonElement, '[data-chain="undo"]')
  const work: Entry[] = sample.entries.map((e) => ({ ...e }))
  const original = work[EDITED - 1]?.body ?? ''
  let tampered = false

  const body = (e: Entry) => {
    if (e.seq !== EDITED || !tampered) return e.body
    const [before, after] = original.split('Node 22')
    return html`${before}Node <del>22</del><ins>20</ins>${after}`
  }
  const draw = (marks: Partial<Record<number, Mark>> = {}) => {
    const blocks = SHOWN.map((seq, i) => {
      const e = work[seq - 1]
      const mark = marks[seq]
      if (!e) return nothing
      return html`${i > 0 ? html`<span class="link" aria-hidden="true"></span>` : nothing}
        <article
          class=${classMap({ blk: true, [`is-${mark}`]: mark !== undefined })}
          ${cssProps({ '--i': String(i) })}
        >
          <p class="blk-top">
            <span class="mono">#${seq}</span><span class="ty ty-${e.type}">${e.type}</span
            ><span>${e.author}</span>
          </p>
          <p class="blk-body">${body(e)}</p>
          <p class="blk-h">prev <b>${e.prev.slice(0, 7)}</b></p>
          <p class="blk-h">hash <b>${e.hash.slice(0, 7)}</b></p>
          <p class="blk-status">${mark ? MARKS[mark] : ''}</p>
        </article>`
    })
    render(html`${blocks}`, box)
  }
  const say = (text: string, tone: 'is-ok' | 'is-bad' | null = null) => {
    out.textContent = text
    out.classList.remove('is-ok', 'is-bad')
    if (tone) out.classList.add(tone)
  }

  verifyButton.addEventListener('click', async () => {
    say('Checking…')
    const result = await verifyChain(work)
    const marks: Record<number, Mark> = {}
    for (const seq of SHOWN) {
      marks[seq] =
        result.ok || seq < result.brokenAt ? 'ok' : seq === result.brokenAt ? 'bad' : 'after'
    }
    draw(marks)
    if (result.ok) {
      say(
        `All ${work.length} entries match their hashes. The head hash is ${result.head.slice(0, 7)}.`,
        'is-ok',
      )
    } else {
      say(
        `Entry #${result.brokenAt} no longer matches its hash, so the chain is broken from #${result.brokenAt} onward.`,
        'is-bad',
      )
    }
  })
  tamperButton.addEventListener('click', () => {
    tampered = true
    const entry = work[EDITED - 1]
    if (entry) work[EDITED - 1] = { ...entry, body: original.replace('Node 22', 'Node 20') }
    draw()
    say(
      `Entry #${EDITED} now says Node 20, but its stored hash still describes the original. Check the chain again.`,
    )
    tamperButton.hidden = true
    undoButton.hidden = false
    verifyButton.focus()
  })
  undoButton.addEventListener('click', () => {
    tampered = false
    const entry = sample.entries[EDITED - 1]
    if (entry) work[EDITED - 1] = { ...entry }
    draw()
    say(`Entry #${EDITED} is back to its original text.`)
    undoButton.hidden = true
    tamperButton.hidden = false
    tamperButton.focus()
  })
  draw()
}
