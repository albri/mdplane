// The reader as a whole page, for /demo and for capability links: a slim bar with the title, the
// reader's toolbar and the theme button, and the reader filling the rest of the screen.
import { html, nothing, render } from 'lit-html'
import { live } from 'lit-html/directives/live.js'
import { $, initTheme } from './dom.ts'
import { Reader } from './reader.ts'

export type App = {
  reader: Reader
  // Shows what's open. With more than one file and a `pick` callback, the file is a picker.
  title: (
    workspace: string,
    files: string[],
    current: string | null,
    pick?: (path: string) => void,
  ) => void
  // Replaces the reader with a message, until a file can be shown.
  say: (message: string) => void
}

const onPick = (pick: (path: string) => void) => (event: Event) => {
  if (event.target instanceof HTMLSelectElement) pick(event.target.value)
}

export function mountApp(): App {
  initTheme()
  const frame = $('#reader')
  const status = $('#app-status')
  const heading = $('#app-title')
  heading.replaceChildren()
  const reader = new Reader(frame, { variant: 'full', level: 2, bar: $('#app-tools') })
  // The reader takes its shortcuts when focus is inside it; this covers nothing being focused.
  document.addEventListener('keydown', reader.onKey)

  return {
    reader,
    title(workspace, files, current, pick) {
      document.title = current ? `${workspace} / ${current} · mdplane` : `${workspace} · mdplane`
      const file =
        files.length > 1 && pick
          ? html`<select
              class="app-file"
              aria-label="File"
              title=${current ?? nothing}
              .value=${live(current ?? '')}
              @change=${onPick(pick)}
            >
              ${files.map((f) => html`<option value=${f} ?selected=${f === current}>${f}</option>`)}
            </select>`
          : html`<span class="file">${current}</span>`
      render(
        html`<span>${workspace}</span>${
            current ? html`<span class="sep" aria-hidden="true">/</span>${file}` : nothing
          }`,
        heading,
      )
      if (current) {
        status.hidden = true
        frame.hidden = false
      }
    },
    say(message) {
      status.textContent = message
      status.hidden = false
      frame.hidden = true
    },
  }
}
