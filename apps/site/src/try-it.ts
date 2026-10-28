// "Try it with your agent": a real workspace made from the landing page, a prompt to hand to an
// agent, and the page's reader following the workspace live. Links are never shown in full; the
// buttons copy them.
import type { CreateWorkspaceResponse } from '@mdplane/contract/core'
import { html, nothing, render, type TemplateResult } from 'lit-html'
import { classMap } from 'lit-html/directives/class-map.js'
import { ApiError, append, createFile, createWorkspace, parseLink } from './api.ts'
import { $, $as, $$, copyText, dateTime, scrollBehavior } from './dom.ts'
import { watch, type Watch } from './live.ts'
import type { Session } from './model.ts'
import type { Reader } from './reader.ts'

const WELCOME = `# Welcome

This workspace was made for you and deletes itself after 24 hours. Don't put secrets in it.
`
const WELCOME_TASK =
  'Introduce yourself: say which tool, model and machine you are running on. Then post a response to finish this task.'
const SAMPLE_TEXT =
  'A replay of a recorded session: four agents and one person working through a release checklist. Drag the timeline to see the file at any point.'

const LINKS = [
  ['read', 'Read link'],
  ['append', 'Append link'],
  ['write', 'Write link'],
] as const

type Phase =
  | { name: 'start'; error?: string }
  | { name: 'creating' }
  | { name: 'created'; workspace: CreateWorkspaceResponse }

const prompt = (link: string) =>
  `Read ${link} and follow the instructions. Pick up the open task in welcome.md and post your result.`

// A link as the page shows it: where it points, with the key hidden.
function masked(link: string): TemplateResult {
  const { host } = new URL(link)
  const info = parseLink(link)
  return html`<span class="masked"
    >${host}/${info?.tier}/<b>${info?.workspaceId}</b><span aria-hidden="true">.••••</span></span
  >`
}

export function initTryIt(hero: Reader, sample: Session): void {
  const dialog = $as(HTMLDialogElement, '#try')
  const body = $('#try-body')
  const stageText = $('#stage-text')
  const stageReader = $as(HTMLAnchorElement, '#stage-reader')
  const backButton = $as(HTMLButtonElement, '#back-sample')
  let phase: Phase = { name: 'start' }
  let copied: string | null = null
  // Shown when the browser won't copy, so the text can be copied by hand.
  let manual: { label: string; text: string } | null = null
  let announcement = ''
  let following: Watch | null = null

  const draw = () => render(template(), body)
  const set = (next: Phase, say = '') => {
    phase = next
    announcement = say
    draw()
  }

  async function create(): Promise<void> {
    set({ name: 'creating' })
    try {
      const workspace = await createWorkspace('welcome')
      await createFile(workspace.links.write, 'welcome.md', WELCOME)
      await append(workspace.links.write, {
        path: 'welcome.md',
        type: 'task',
        author: 'mdplane',
        body: WELCOME_TASK,
      })
      set(
        { name: 'created', workspace },
        'Workspace created. Next, copy the prompt for your agent.',
      )
      $('#try-copy-prompt', body).focus()
    } catch (error) {
      set({
        name: 'start',
        error:
          error instanceof ApiError && error.status === 429
            ? 'Too many workspaces from your address. Try again in a minute.'
            : "Couldn't create a workspace. Try again.",
      })
    }
  }

  async function copy(id: string, label: string, text: string): Promise<void> {
    const done = await copyText(text)
    copied = done ? id : null
    manual = done ? null : { label, text }
    announcement = done ? `${label} copied.` : ''
    draw()
    if (done) {
      window.setTimeout(() => {
        if (copied === id) copied = null
        draw()
      }, 1600)
    } else {
      $as(HTMLInputElement, '.manual input', body).select()
    }
  }

  async function follow(workspace: CreateWorkspaceResponse, scripted: boolean): Promise<void> {
    const read = parseLink(workspace.links.read)
    if (!read) return
    dialog.close()
    following?.stop()
    hero.touched = true
    const stage = $('#stage')
    stage.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    stage.focus({ preventScroll: true })
    following = await watch(read, hero, { path: 'welcome.md' })
    stageText.textContent = scripted
      ? 'Your workspace, live. A scripted agent is working through the welcome task.'
      : "Your workspace, live. Your agent's entries appear here as it works."
    stageReader.href = workspace.links.read
    backButton.hidden = false
    if (scripted) void runScriptedAgent(workspace.links.append)
  }

  const copyButton = (id: string, label: string, text: string, className = 'btn-quiet') =>
    html`<button
      type="button"
      class="btn btn-sm ${className}"
      id=${id}
      @click=${() => void copy(id, label, text)}
    >
      ${copied === id ? 'Copied' : `Copy ${label.toLowerCase()}`}
    </button>`

  function template(): TemplateResult {
    const workspace = phase.name === 'created' ? phase.workspace : null
    const step = (n: number, title: string, content: TemplateResult | typeof nothing) => {
      const done = n === 1 && workspace !== null
      const current = workspace ? n === 2 : n === 1
      return html`<li
        class=${classMap({ step: true, 'is-done': done, 'is-current': current, 'is-locked': !workspace && n > 1 })}
      >
        <h3>${title}</h3>
        ${content === nothing ? nothing : html`<div class="step-body">${content}</div>`}
      </li>`
    }
    return html`
      <p class="dlg-lead">
        Make a real workspace, hand its link to an agent, and watch the work arrive in the reader on
        this page. It deletes itself after 24 hours, so don't put secrets in it.
      </p>
      <ol class="steps">
        ${step(
          1,
          workspace ? 'Workspace created' : 'Create a workspace',
          workspace
            ? html`<p>
                  ${
                    workspace.expiresAt
                      ? `It lasts until ${dateTime()(workspace.expiresAt)}.`
                      : 'It lasts until you delete it.'
                  }
                </p>
                <div class="dlg-actions" role="group" aria-label="Links">
                  ${LINKS.map(([key, label]) =>
                    copyButton(`try-copy-${key}`, label, workspace.links[key]),
                  )}
                </div>`
            : html`<div class="dlg-actions">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    autofocus
                    aria-disabled=${String(phase.name === 'creating')}
                    @click=${() => {
                      if (phase.name === 'start') void create()
                    }}
                  >
                    ${phase.name === 'creating' ? 'Creating…' : 'Create workspace'}
                  </button>
                </div>
                ${
                  phase.name === 'start' && phase.error
                    ? html`<p class="dlg-error" role="alert">${phase.error}</p>`
                    : nothing
                }
                <details class="curl">
                  <summary>Or with curl</summary>
                  <pre class="code" tabindex="0">curl -X POST ${location.origin}/workspaces</pre>
                </details>`,
        )}
        ${step(
          2,
          'Give your agent this prompt',
          workspace
            ? html`<blockquote class="prompt">
                  Read ${masked(workspace.links.append)} and follow the instructions. Pick up the
                  open task in welcome.md and post your result.
                </blockquote>
                <div class="dlg-actions">
                  ${copyButton(
                    'try-copy-prompt',
                    'Prompt',
                    prompt(workspace.links.append),
                    'btn-primary',
                  )}
                </div>`
            : nothing,
        )}
        ${step(
          3,
          'Watch it work',
          workspace
            ? html`<p>
                  Its entries appear in the reader on this page. No agent to hand? A scripted one
                  makes the same requests from your browser.
                </p>
                <div class="dlg-actions">
                  <button
                    type="button"
                    class="btn btn-quiet btn-sm"
                    @click=${() => void follow(workspace, false)}
                  >
                    Watch here
                  </button>
                  <button
                    type="button"
                    class="btn btn-quiet btn-sm"
                    @click=${() => void follow(workspace, true)}
                  >
                    Run a scripted agent
                  </button>
                </div>`
            : nothing,
        )}
      </ol>
      ${
        manual
          ? html`<label class="manual">
              Your browser didn't allow copying. Copy the ${manual.label.toLowerCase()} from here:
              <input readonly .value=${manual.text} />
            </label>`
          : nothing
      }
      <p class="visually-hidden" role="status">${announcement}</p>
    `
  }

  for (const button of $$('[data-open-try]')) {
    button.addEventListener('click', () => {
      if (phase.name === 'start') set({ name: 'start' })
      dialog.showModal()
    })
  }

  backButton.addEventListener('click', () => {
    following?.stop()
    following = null
    hero.load(sample)
    stageText.textContent = SAMPLE_TEXT
    stageReader.href = '/demo'
    backButton.hidden = true
    stageReader.focus()
  })

  draw()
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
