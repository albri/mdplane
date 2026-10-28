import {
  type CreateWorkspaceResponse,
  type Entry,
  instructions,
  renderInstructions,
  verifyChain,
} from '@mdplane/contract/core'
import { ApiError, append, createFile, createWorkspace, parseLink } from './api.ts'
import { $, $as, $$, copyText, esc, initTabs, initTheme, motionOK } from './dom.ts'
import { watch, type Watch } from './live.ts'
import { agentView, type Session, stateAt } from './model.ts'
import { highlight, Reader } from './reader.ts'
import { sampleSession } from './sample.ts'

initTheme()
initTabs()

const SAMPLE_TEXT =
  'A replay of a recorded session: four agents and one person working through a release checklist. Drag the timeline to see the file at any point.'

const hero = new Reader($('#hero-reader'), { compact: true })
const full = new Reader($('#full-reader'))
const sample = await sampleSession()
hero.load(sample, { pos: motionOK() ? 9 : sample.entries.length })
full.load(sample)
void hero.verify()
void full.verify()

const sampleAtHead = stateAt(sample, sample.entries.length)
$('#ws-source').innerHTML = highlight(agentView(sample, sampleAtHead))
$('#inst-text').innerHTML = highlight(agentInstructions(sample))

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
).observe($('#hero-reader'))

/* The chain demo: entries #13 to #17 of the sample, and what happens when one is edited. */
function initChain(): void {
  const box = $('#chain')
  const out = $('#chain-out')
  const verifyButton = $as(HTMLButtonElement, '[data-chain="verify"]')
  const tamperButton = $as(HTMLButtonElement, '[data-chain="tamper"]')
  const undoButton = $as(HTMLButtonElement, '[data-chain="undo"]')
  const shown = [13, 14, 15, 16, 17]
  const work: Entry[] = sample.entries.map((e) => ({ ...e }))
  const original = work[14]?.body ?? ''
  let tampered = false

  const draw = (marks: Record<number, 'ok' | 'bad' | 'after'> = {}) => {
    box.innerHTML = shown
      .map((seq, i) => {
        const e = work[seq - 1]
        if (!e) return ''
        let body = esc(e.body ?? '')
        if (seq === 15 && tampered) {
          const [before = '', after = ''] = original.split('Node 22')
          body = `${esc(before)}Node <del>22</del><ins>20</ins>${esc(after)}`
        }
        const mark = marks[seq]
        const label = mark
          ? { ok: 'Matches', bad: "Doesn't match", after: 'After the break' }[mark]
          : ''
        return `${i ? '<span class="link" aria-hidden="true"></span>' : ''}<article class="blk${mark ? ` is-${mark}` : ''}">
          <p class="blk-top"><span class="mono">#${seq}</span><span class="ty ty-${e.type}">${e.type}</span><span>${esc(e.author)}</span></p>
          <p class="blk-body">${body}</p>
          <p class="blk-h">prev <b>${e.prev.slice(0, 7)}</b></p>
          <p class="blk-h">hash <b>${e.hash.slice(0, 7)}</b></p>
          <p class="blk-status">${label}</p>
        </article>`
      })
      .join('')
    // Set through the CSSOM, which the content security policy allows; style attributes it doesn't.
    for (const [i, block] of $$('.blk', box).entries()) block.style.setProperty('--i', String(i))
  }

  verifyButton.addEventListener('click', async () => {
    out.className = 'chain-out'
    out.textContent = 'Checking…'
    const result = await verifyChain(work)
    const marks: Record<number, 'ok' | 'bad' | 'after'> = {}
    for (const seq of shown) {
      marks[seq] =
        result.ok || seq < result.brokenAt ? 'ok' : seq === result.brokenAt ? 'bad' : 'after'
    }
    draw(marks)
    if (result.ok) {
      out.className = 'chain-out is-ok'
      out.textContent = `All ${work.length} entries match their hashes. The head hash is ${result.head.slice(0, 7)}.`
    } else {
      out.className = 'chain-out is-bad'
      out.textContent = `Entry #${result.brokenAt} no longer matches its hash, so the chain is broken from #${result.brokenAt} onward.`
    }
  })
  tamperButton.addEventListener('click', () => {
    tampered = true
    const entry = work[14]
    if (entry) work[14] = { ...entry, body: original.replace('Node 22', 'Node 20') }
    draw()
    out.className = 'chain-out'
    out.textContent =
      'Entry #15 now says Node 20, but its stored hash still describes the original. Check the chain again.'
    tamperButton.hidden = true
    undoButton.hidden = false
    verifyButton.focus()
  })
  undoButton.addEventListener('click', () => {
    tampered = false
    const entry = sample.entries[14]
    if (entry) work[14] = { ...entry }
    draw()
    out.className = 'chain-out'
    out.textContent = 'Entry #15 is back to its original text.'
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
$('#try-curl').textContent = `curl -X POST ${location.origin}/workspaces`
const stageText = $('#stage-text')
const stageReader = $as(HTMLAnchorElement, '#stage-reader')
const backButton = $as(HTMLButtonElement, '#back-sample')
const createButton = $as(HTMLButtonElement, '#try-create')
const tryError = $('#try-error')
let created: CreateWorkspaceResponse | null = null
let following: Watch | null = null

function resetTry(): void {
  created = null
  $('#try-links').hidden = true
  tryError.hidden = true
  createButton.disabled = false
  createButton.textContent = 'Create workspace'
  for (const id of ['#try-step2', '#try-step3']) $(id).classList.add('is-locked')
  for (const id of ['#try-copy', '#try-watch', '#try-script'])
    $as(HTMLButtonElement, id).disabled = true
  $('#try-prompt').textContent = 'Create a workspace first.'
}

for (const button of $$('[data-open-try]')) {
  button.addEventListener('click', () => {
    if (!created) resetTry()
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
  const rows = [
    ['Read', links.read],
    ['Append', links.append],
    ['Write', links.write],
  ]
  const list = $('#try-links')
  list.innerHTML = rows
    .map(([label, url]) => `<div><span>${label}</span><code>${esc(url)}</code></div>`)
    .join('')
  list.hidden = false
  createButton.textContent = 'Created'
  $('#try-prompt').textContent =
    `Read ${links.append} and follow the instructions. Pick up the open task in welcome.md and post your result.`
  for (const id of ['#try-step2', '#try-step3']) $(id).classList.remove('is-locked')
  for (const id of ['#try-copy', '#try-watch', '#try-script'])
    $as(HTMLButtonElement, id).disabled = false
})

$as(HTMLButtonElement, '#try-copy').addEventListener('click', (event) => {
  const prompt = $('#try-prompt')
  if (event.currentTarget instanceof HTMLButtonElement) {
    copyText(event.currentTarget, prompt.textContent ?? '', prompt)
  }
})

async function showLive(scripted: boolean): Promise<void> {
  if (!created) return
  const read = parseLink(created.links.read)
  if (!read) return
  dialog.close()
  following?.stop()
  hero.touched = true
  if (location.hash === '#reader') location.hash = '#stage'
  $('#stage').scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' })
  following = await watch(read, hero, { path: 'welcome.md' })
  stageText.textContent = scripted
    ? 'Your workspace, live. A scripted agent is working through the welcome task.'
    : "Your workspace, live. Your agent's entries appear here as it works."
  stageReader.href = created.links.read
  backButton.hidden = false
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

$('#try-watch').addEventListener('click', () => void showLive(false))
$('#try-script').addEventListener('click', () => void showLive(true))

backButton.addEventListener('click', () => {
  following?.stop()
  following = null
  hero.load(sample)
  void hero.verify()
  stageText.textContent = SAMPLE_TEXT
  stageReader.href = '#reader'
  backButton.hidden = true
})

/* Routing: #reader shows the full reader on the sample, anything else the landing page. */
const landing = $('#landing')
const readerPage = $('#reader-page')
function showRoute(): void {
  const onReader = location.hash === '#reader'
  landing.hidden = onReader
  readerPage.hidden = !onReader
  if (onReader) {
    hero.pause()
    window.scrollTo({ top: 0, behavior: 'instant' })
    full.update()
    return
  }
  const target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null
  if (target && target.id !== 'top') target.scrollIntoView({ behavior: 'instant' })
  else if (location.hash === '#top') window.scrollTo({ top: 0, behavior: 'instant' })
}
window.addEventListener('hashchange', () => {
  const switching = (location.hash === '#reader') === readerPage.hidden
  if (switching && 'startViewTransition' in document && motionOK())
    document.startViewTransition(showRoute)
  else showRoute()
})
showRoute()

document.addEventListener('keydown', (event) => {
  if (readerPage.hidden || dialog.open || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target instanceof HTMLElement ? event.target : null
  const tag = target?.tagName.toLowerCase() ?? ''
  if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (target?.closest('[role="tablist"], .seg')) return
    event.preventDefault()
    full.step(event.key === 'ArrowLeft' ? -1 : 1)
  } else if (event.key === ' ' && tag !== 'button' && tag !== 'a') {
    event.preventDefault()
    full.toggle()
  }
})
