// A capability URL opened in a browser: the reader on the real workspace, kept live.
import { isGone, isRateLimited, parseLink } from './api.ts'
import { mountApp } from './app.ts'
import { type Watch, watch } from './live.ts'

const GONE =
  "This link doesn't work. It may be mistyped, revoked, or for a workspace that has expired."

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
    // The link was revoked or its workspace expired while the page was open.
    onStatus: (status) => {
      if (status === 'ended') app.say(GONE)
    },
  })
  showTitle(live)
  if (!app.reader.session) {
    app.say(
      link.tier === 'w'
        ? 'No files yet. Create one with PUT $URL/files/{path}, and it appears here.'
        : 'No files yet. They appear here as soon as someone creates one.',
    )
  }
  // Every change goes to the watch, even back to the file on screen: a switch still on its way
  // would otherwise land after it.
  window.addEventListener('hashchange', () => {
    const path = fileFromHash()
    if (path && live.files().includes(path)) {
      live.show(path).then(
        () => showTitle(live),
        () => app.say("Couldn't open that file. Check your connection and reload the page."),
      )
    }
  })
}

main().catch((error: unknown) => {
  app.say(
    isGone(error)
      ? GONE
      : isRateLimited(error)
        ? 'Too many requests on this link for now. Wait a minute, then reload the page.'
        : "Couldn't load this workspace. Check your connection and reload the page.",
  )
})
