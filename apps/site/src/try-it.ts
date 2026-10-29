// "Try it with your agent": a real workspace made from the landing page, a prompt that hands its
// write link to an agent, and the page's reader following the workspace live. The page writes
// nothing in the workspace: the agent sets the job. Links are never shown in full; the buttons
// copy them. The dialog keeps the workspace for as long as the page is open, so a link pushed off
// the clipboard can be copied again.
import type { CreateWorkspaceResponse } from '@mdplane/contract/core'
import { html, nothing, render, type TemplateResult } from 'lit-html'
import { classMap } from 'lit-html/directives/class-map.js'
import { append, createFile, createWorkspace, isPaused, isRateLimited, parseLink } from './api.ts'
import { $, $as, $$, copyText, dateTime, scrollBehavior } from './dom.ts'
import { watch, type Watch } from './live.ts'
import type { Session } from './model.ts'
import type { Reader } from './reader.ts'

const SAMPLE_TITLE = 'One session, start to finish'
const SAMPLE_TEXT =
  'A lead agent and four others work through the 2.4 release checklist. Drag the timeline to see any moment.'
const WAITING = 'Waiting for your agent to write the brief…'

// What each link can do, in the words of the permissions table on the page.
const LINKS = [
  { tier: 'read', name: 'Read', can: 'See the files and their history, and watch live.', note: '' },
  { tier: 'append', name: 'Append', can: 'Also add entries and claim tasks.', note: '' },
  {
    tier: 'write',
    name: 'Write',
    can: 'Also edit files and manage links.',
    note: 'The prompt gives it to your agent.',
  },
] as const

type Phase =
  | { name: 'start'; error?: string }
  | { name: 'creating' }
  | { name: 'created'; workspace: CreateWorkspaceResponse }

// The agent picks the job and the file, so the page has nothing to write first.
const ASK =
  'Lead a short test job: write a brief, add three small tasks that need nothing outside the workspace, and work through them. Start other agents for the tasks if you can.'

const prompt = (link: string) => `Read ${link} and follow the instructions. ${ASK}`

const until = (workspace: CreateWorkspaceResponse) =>
  workspace.expiresAt ? `until ${dateTime()(workspace.expiresAt)}` : 'until you delete it'

// The links as one block that still makes sense pasted into notes.
const linksText = (workspace: CreateWorkspaceResponse) =>
  [
    `mdplane workspace links. They work ${until(workspace)}.`,
    ...LINKS.map(({ tier, name, can }) => `\n${name}: ${workspace.links[tier]}\n${can}`),
  ].join('\n')

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
  const stageTitle = $('#stage-h')
  const stageText = $('#stage-text')
  const stageReader = $as(HTMLAnchorElement, '#stage-reader')
  const heroFrame = $('#hero-reader')
  const backButton = $as(HTMLButtonElement, '#back-sample')
  const linksButton = $as(HTMLButtonElement, '#open-links')
  let phase: Phase = { name: 'start' }
  let copied: string | null = null
  // Shown when the browser won't copy, so the text can be copied by hand.
  let manual: string | null = null
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
      set(
        { name: 'created', workspace },
        'Workspace created. Next, copy the prompt for your agent.',
      )
      $('#try-copy-prompt', body).focus()
    } catch (error) {
      set({
        name: 'start',
        // The server says why new workspaces are paused, and until when.
        error: isPaused(error)
          ? error.message
          : isRateLimited(error)
            ? 'Too many workspaces from your address. Try again in a minute.'
            : "Couldn't create a workspace. Try again.",
      })
    }
  }

  async function copy(id: string, name: string, text: string): Promise<void> {
    const done = await copyText(text)
    copied = done ? id : null
    manual = done ? null : text
    announcement = done
      ? `${name.charAt(0).toUpperCase()}${name.slice(1)} copied.`
      : `Your browser blocked copying the ${name}. It's selected below to copy by hand.`
    draw()
    if (done) {
      window.setTimeout(() => {
        if (copied === id) copied = null
        draw()
      }, 1600)
    } else {
      $as(HTMLTextAreaElement, '.manual textarea', body).select()
    }
  }

  async function follow(workspace: CreateWorkspaceResponse, scripted: boolean): Promise<void> {
    const read = parseLink(workspace.links.read)
    if (!read) return
    dialog.close()
    following?.stop()
    following = null
    hero.touched = true
    const working = scripted
      ? 'A scripted agent is setting a job and working through it.'
      : "Your agent's entries appear here as it works."
    // The heading changes before focus moves to the stage, so focus announces the new one.
    stageTitle.textContent = 'Your workspace, live'
    stageText.textContent = 'Connecting to your workspace…'
    backButton.hidden = false
    linksButton.hidden = false
    const stage = $('#stage')
    stage.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    stage.focus({ preventScroll: true })
    try {
      following = await watch(read, hero, {
        // Until the agent writes its first file there is nothing to show, not even an empty file.
        onFiles: () => {
          heroFrame.hidden = false
          stageText.textContent = working
        },
        onStatus: (status) => {
          if (status === 'ended')
            stageText.textContent = 'This workspace has expired or its link was revoked.'
        },
      })
    } catch {
      stageText.textContent =
        "Couldn't connect to your workspace. Check your connection and try again."
      return
    }
    const empty = following.files().length === 0
    heroFrame.hidden = empty
    stageText.textContent = empty ? WAITING : working
    stageReader.href = workspace.links.read
    if (scripted) {
      runScriptedAgent(workspace.links.write).catch(() => {
        stageText.textContent =
          'The scripted agent stopped: a request failed. Try it again from Your links.'
      })
    }
  }

  // `short` buttons say only "Copy" and rely on their row for the rest; their accessible name
  // still says what they copy.
  const copyButton = (
    id: string,
    name: string,
    text: string,
    { primary = false, short = false } = {},
  ) =>
    html`<button
      type="button"
      class=${classMap({ btn: true, 'btn-sm': true, 'btn-primary': primary, 'btn-quiet': !primary })}
      id=${id}
      @click=${() => void copy(id, name, text)}
    >
      ${
        copied === id
          ? 'Copied'
          : short
            ? html`Copy<span class="visually-hidden"> ${name}</span>`
            : `Copy ${name}`
      }
    </button>`

  const links = (workspace: CreateWorkspaceResponse) =>
    html`<section class="keys" aria-labelledby="try-keys-h">
      <div class="keys-head">
        <h3 id="try-keys-h">Your links</h3>
        ${copyButton('try-copy-all', 'all links', linksText(workspace))}
      </div>
      <p>
        Only a hash of each key is stored, so a lost link can't be recovered. Save them before you
        leave this page.
      </p>
      <ul>
        ${LINKS.map(
          ({ tier, name, can, note }) =>
            html`<li>
              <span class="tier">${name}</span>
              <span class="can">${can}${note ? ` ${note}` : ''}</span>
              ${copyButton(`try-copy-${tier}`, `${tier} link`, workspace.links[tier], { short: true })}
            </li>`,
        )}
      </ul>
    </section>`

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
      ${
        workspace
          ? nothing
          : html`<p class="dlg-lead">
              Make a real workspace and give its write link to your agent. Your agent sets a small
              job, and you watch the work in the reader on this page. The workspace deletes itself
              after 72 hours, so don't put secrets in it.
            </p>`
      }
      <ol class="steps">
        ${step(
          1,
          workspace ? 'Workspace created' : 'Create a workspace',
          workspace
            ? html`<p>It lasts ${until(workspace)}.</p>`
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
                  Read ${masked(workspace.links.write)} and follow the instructions. ${ASK}
                </blockquote>
                <div class="dlg-actions">
                  ${copyButton('try-copy-prompt', 'prompt', prompt(workspace.links.write), {
                    primary: true,
                  })}
                </div>`
            : nothing,
        )}
        ${step(
          3,
          'Watch it work',
          workspace
            ? html`<p>
                  Its entries appear in the reader on this page. No agent to hand? A scripted one
                  sets a job and makes the same requests from your browser.
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
      ${workspace ? links(workspace) : nothing}
      ${
        manual === null
          ? nothing
          : html`<label class="manual">
              Your browser blocked copying. Select the text and copy it from here:
              <textarea readonly rows="3" .value=${manual}></textarea>
            </label>`
      }
      <p class="visually-hidden" role="status">${announcement}</p>
    `
  }

  for (const button of $$('[data-open-try]')) {
    button.addEventListener('click', () => {
      if (phase.name === 'start') set({ name: 'start' })
      dialog.showModal()
      if (button === linksButton) $('#try-copy-all', body).focus()
    })
  }

  backButton.addEventListener('click', () => {
    following?.stop()
    following = null
    hero.load(sample)
    heroFrame.hidden = false
    stageTitle.textContent = SAMPLE_TITLE
    stageText.textContent = SAMPLE_TEXT
    stageReader.href = '/demo'
    backButton.hidden = true
    linksButton.hidden = true
    stageReader.focus()
  })

  draw()
}

const SCRIPTED_BRIEF = `# A scripted test

A scripted agent in your browser set this job. It makes the same requests as any agent.
`

// The scripted agent's requests are paced so you can watch each one land.
const pause = () => new Promise((resolve) => window.setTimeout(resolve, 1800))

// The requests a lead agent makes with its write link, sent from this browser: write the brief and
// add a task, then claim it, comment and respond.
async function runScriptedAgent(link: string): Promise<void> {
  const author = 'scripted-agent@browser'
  const path = 'welcome.md'
  await pause()
  await createFile(link, path, SCRIPTED_BRIEF)
  await pause()
  const { entry } = await append(link, {
    path,
    type: 'task',
    author,
    body: 'Say hello from the browser.',
  })
  const ref = entry.seq
  await pause()
  // The claim's token, which the response needs to finish the task.
  const { lease } = await append(link, { path, type: 'claim', author, ref })
  await pause()
  await append(link, {
    path,
    type: 'comment',
    author,
    ref,
    body: 'Read the instructions at the link. A write link can set the job and do the work.',
  })
  await pause()
  await append(link, {
    path,
    type: 'response',
    author,
    ref,
    body: 'Hello from a scripted agent in your browser. That took five requests: write the brief, add a task, claim it, comment and respond.',
    ...(lease && { token: lease.token }),
  })
}
