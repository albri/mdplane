// A capability URL opened in a browser: the reader on the real workspace, kept live.
import { ApiError, parseLink } from './api.ts'
import { mountApp } from './app.ts'
import { type Watch, watch } from './live.ts'

const app = mountApp()
const fileFromHash = () => decodeURIComponent(location.hash.slice(1)) || undefined

const showTitle = (live: Watch) =>
  app.title(
    live.workspace.name ?? live.workspace.id,
    live.files(),
    app.reader.session?.path ?? null,
    (path) => {
      location.hash = encodeURIComponent(path)
    },
  )

async function main(): Promise<void> {
  const link = parseLink(location.href)
  if (!link) {
    app.say('This page needs a workspace link.')
    return
  }
  // New files arrive on the live stream, after `live` is assigned.
  const live: Watch = await watch(link, app.reader, {
    path: fileFromHash(),
    onFiles: () => showTitle(live),
  })
  showTitle(live)
  if (!app.reader.session) {
    app.say(
      link.tier === 'w'
        ? 'No files yet. Create one with PUT $URL/files/{path}, and it appears here.'
        : 'No files yet. They appear here as soon as someone creates one.',
    )
  }
  window.addEventListener('hashchange', () => {
    const path = fileFromHash()
    if (path && path !== app.reader.session?.path && live.files().includes(path)) {
      void live.show(path).then(() => showTitle(live))
    }
  })
}

main().catch((error: unknown) => {
  app.say(
    error instanceof ApiError && error.status === 404
      ? "This link doesn't work. It may be mistyped, revoked, or for a workspace that has expired."
      : "Couldn't load this workspace. Check your connection and reload the page.",
  )
})
