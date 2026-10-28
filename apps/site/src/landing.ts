import {
  type CreateWorkspaceResponse,
  type Entry,
  instructions,
  renderInstructions,
  verifyChain,
} from '@mdplane/contract/core'
import { html, nothing, render } from 'lit-html'
import { classMap } from 'lit-html/directives/class-map.js'
import { ApiError, append, createFile, createWorkspace, parseLink } from './api.ts'
import {
  $,
  $as,
  $$,
  copyText,
  cssProps,
  initTabs,
  initTheme,
  motionOK,
  scrollBehavior,
} from './dom.ts'
import { watch, type Watch } from './live.ts'
import { agentView, type Session, stateAt } from './model.ts'
import { highlight, Reader } from './reader.ts'
import { sampleSession } from './sample.ts'

initTheme()
initTabs()

const SAMPLE_TEXT =
  'A replay of a recorded session: four agents and one person working through a release checklist. Drag the timeline to see the file at any point.'

const hero = new Reader($('#hero-reader'), { variant: 'compact', level: 3 })
const sample = await sampleSession()
hero.load(sample, { pos: motionOK() ? 9 : sample.entries.length })

render(highlight(agentView(sample, stateAt(sample, sample.entries.length))), $('#ws-source'))
render(highlight(agentInstructions(sample)), $('#inst-text'))

// The real instructions an append link gets, with "Right now" computed from the sample.
function agentInstructions(session: Session): string {
  const state = stateAt(session, session.entries.length)
  const last = session.entries.at(-1)
  const write = state.write
  if (!last || !write) return instructions.a
  return renderInstructions(
    {
      id: session.workspaceId,
      name: session.name,
      expiresAt: null,
      link: {
        id: 'ln_Hq8Tz3Vn6Ry1',
        tier: 'a',
        folder: null,
        createdAt: session.entries[0]?.at ?? last.at,
      },
      head: { seq: last.seq, hash: last.hash },
      files: [
        {
          path: session.path,
          version: write.version ?? 1,
          contentHash: write.contentHash ?? '',
          updatedAt: write.at,
          lastSeq: last.seq,
        },
      ],
    },
    { [session.path]: state.threads.map((t) => t.task) },
  )
}

// Hero replay: start mid-session and play to the end once, when the reader is on screen.
let autoplay = motionOK()
new IntersectionObserver(
  (items) => {
    for (const item of items) {
      if (item.isIntersecting && autoplay) {
        autoplay = false
        window.setTimeout(() => {
          if (!hero.touched && hero.session === sample) hero.play()
        }, 900)
      }
      if (!item.isIntersecting) hero.pause()
    }
  },
  { threshold: 0.35 },
).observe(hero.root)

/* The chain demo: entries #13 to #17 of the sample, and what happens when one is edited. */
type Mark = 'ok' | 'bad' | 'after'
const MARKS: Record<Mark, string> = {
  ok: 'Matches',
  bad: "Doesn't match",
  after: 'After the break',
}
const SHOWN = [13, 14, 15, 16, 17]
const EDITED = 15

function initChain(): void {
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
if (globalThis.crypto?.subtle) initChain()

/* Try it: a real workspace, created from this page. */
const WELCOME = `# Welcome

This workspace was made for you and deletes itself after 24 hours. Don't put secrets in it.
`
const WELCOME_TASK =
  'Introduce yourself: say which tool, model and machine you are running on. Then post a response to finish this task.'

const dialog = $as(HTMLDialogElement, '#try')
const createButton = $as(HTMLButtonElement, '#try-create')
const copyButton = $as(HTMLButtonElement, '#try-copy')
const followButtons = [$as(HTMLButtonElement, '#try-watch'), $as(HTMLButtonElement, '#try-script')]
const tryError = $('#try-error')
const tryStatus = $('#try-status')
const tryLinks = $('#try-links')
const prompt = $('#try-prompt')
const stageText = $('#stage-text')
const stageReader = $as(HTMLAnchorElement, '#stage-reader')
const backButton = $as(HTMLButtonElement, '#back-sample')
let created: CreateWorkspaceResponse | null = null
let following: Watch | null = null

$('#try-curl').textContent = `curl -X POST ${location.origin}/workspaces`

function unlock(on: boolean): void {
  for (const id of ['#try-step2', '#try-step3']) $(id).classList.toggle('is-locked', !on)
  for (const button of [copyButton, ...followButtons]) button.disabled = !on
}

for (const button of $$('[data-open-try]')) {
  button.addEventListener('click', () => {
    if (!created) {
      tryLinks.hidden = true
      tryError.hidden = true
      prompt.textContent = 'Create a workspace first.'
      unlock(false)
    }
    dialog.showModal()
  })
}

createButton.addEventListener('click', async () => {
  createButton.disabled = true
  createButton.textContent = 'Creating…'
  tryError.hidden = true
  try {
    const workspace = await createWorkspace('welcome')
    await createFile(workspace.links.write, 'welcome.md', WELCOME)
    await append(workspace.links.write, {
      path: 'welcome.md',
      type: 'task',
      author: 'mdplane',
      body: WELCOME_TASK,
    })
    created = workspace
  } catch (error) {
    createButton.disabled = false
    createButton.textContent = 'Create workspace'
    tryError.hidden = false
    tryError.textContent =
      error instanceof ApiError && error.status === 429
        ? 'Too many workspaces from your address. Try again in a minute.'
        : "Couldn't create a workspace. Try again."
    return
  }
  const { links } = created
  render(
    html`${(
      [
        ['Read', links.read],
        ['Append', links.append],
        ['Write', links.write],
      ] as const
    ).map(([label, url]) => html`<div><span>${label}</span><code>${url}</code></div>`)}`,
    tryLinks,
  )
  tryLinks.hidden = false
  createButton.textContent = 'Created'
  prompt.textContent = `Read ${links.append} and follow the instructions. Pick up the open task in welcome.md and post your result.`
  unlock(true)
  tryStatus.textContent = 'Workspace created. Next, copy the prompt for your agent.'
  copyButton.focus()
})

copyButton.addEventListener('click', async () => {
  const result = await copyText(prompt.textContent ?? '', prompt)
  const label = 'Copy prompt'
  copyButton.textContent = result === 'copied' ? 'Copied' : 'Selected'
  tryStatus.textContent =
    result === 'copied' ? 'Prompt copied.' : 'Prompt selected. Copy it with your keyboard.'
  window.setTimeout(() => {
    copyButton.textContent = label
  }, 1600)
})

async function showLive(scripted: boolean): Promise<void> {
  if (!created) return
  const read = parseLink(created.links.read)
  if (!read) return
  dialog.close()
  following?.stop()
  hero.touched = true
  $('#stage').scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
  following = await watch(read, hero, { path: 'welcome.md' })
  stageText.textContent = scripted
    ? 'Your workspace, live. A scripted agent is working through the welcome task.'
    : "Your workspace, live. Your agent's entries appear here as it works."
  stageReader.href = created.links.read
  backButton.hidden = false
  $('#stage').focus({ preventScroll: true })
  if (scripted) void runScriptedAgent(created.links.append)
}

// Three requests from this browser, the same ones an agent makes: claim, comment, respond.
async function runScriptedAgent(link: string): Promise<void> {
  const steps = [
    ['claim', 'Claiming the welcome task.'],
    [
      'comment',
      'Read the instructions at the link. I have an append link, so I can read the file and add to its log.',
    ],
    [
      'response',
      'Hello from a scripted agent in your browser. That took three requests: claim the task, post a comment, post this response.',
    ],
  ] as const
  for (const [type, body] of steps) {
    // oxlint-disable-next-line no-await-in-loop -- the steps are paced so you can watch them land
    await new Promise((resolve) => window.setTimeout(resolve, 1800))
    // oxlint-disable-next-line no-await-in-loop -- each step follows the one before
    await append(link, { path: 'welcome.md', type, author: 'scripted-agent@browser', ref: 2, body })
  }
}

followButtons[0]?.addEventListener('click', () => void showLive(false))
followButtons[1]?.addEventListener('click', () => void showLive(true))

backButton.addEventListener('click', () => {
  following?.stop()
  following = null
  hero.load(sample)
  stageText.textContent = SAMPLE_TEXT
  stageReader.href = '/demo'
  backButton.hidden = true
  stageReader.focus()
})
