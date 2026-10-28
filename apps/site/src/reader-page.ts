// The page a browser gets from a capability URL: the reader on the real workspace, kept live.
import { ApiError, parseLink } from './api.ts'
import { $, $as, esc, initTheme } from './dom.ts'
import { watch } from './live.ts'
import { Reader } from './reader.ts'

initTheme()

const title = $('#rp-title')
const status = $('#rp-status')
const picker = $as(HTMLSelectElement, '#rp-file')
const frame = $('#rp-frame')

function say(message: string): void {
  status.textContent = message
  status.hidden = false
}

const fileFromHash = () => decodeURIComponent(location.hash.slice(1)) || undefined

async function main(): Promise<void> {
  const link = parseLink(location.href)
  if (!link) {
    say('This page needs a workspace link.')
    return
  }
  const reader = new Reader($('#full-reader'))
  let name = link.workspaceId
  const render = (files: string[]) => {
    picker.innerHTML = files.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('')
    picker.hidden = files.length < 2
    if (!reader.session) {
      title.textContent = name
      return
    }
    picker.value = reader.session.path
    frame.hidden = false
    status.hidden = true
    title.innerHTML = `${esc(name)} <span>/</span> ${esc(reader.session.path)}`
  }
  const live = await watch(link, reader, { path: fileFromHash(), onFiles: render })
  name = live.workspace.name ?? live.workspace.id
  document.title = `${name} · mdplane`
  render(live.files())
  if (!reader.session) {
    say(
      link.tier === 'w'
        ? 'No files yet. Create one with PUT $URL/files/{path}, and it appears here.'
        : 'No files yet. They appear here as soon as someone creates one.',
    )
  }
  picker.addEventListener('change', () => {
    location.hash = encodeURIComponent(picker.value)
  })
  window.addEventListener('hashchange', () => {
    const path = fileFromHash()
    if (path && path !== reader.session?.path && live.files().includes(path)) {
      void live.show(path).then(() => render(live.files()))
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target instanceof HTMLElement ? event.target : null
    const tag = target?.tagName.toLowerCase() ?? ''
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || target?.isContentEditable)
      return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (target?.closest('.seg')) return
      event.preventDefault()
      reader.step(event.key === 'ArrowLeft' ? -1 : 1)
    } else if (event.key === ' ' && tag !== 'button' && tag !== 'a') {
      event.preventDefault()
      reader.toggle()
    }
  })
}

main().catch((error: unknown) => {
  say(
    error instanceof ApiError && error.status === 404
      ? "This link doesn't work. It may be mistyped, revoked, or for a workspace that has expired."
      : "Couldn't load this workspace. Check your connection and reload the page.",
  )
})
