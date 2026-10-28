// The landing page: the sample session replaying in the hero, the explainer figures, the chain
// demo and the Try it dialog.
import { instructions, renderInstructions } from '@mdplane/contract/core'
import { render } from 'lit-html'
import { initChainDemo } from './chain-demo.ts'
import { $, initTabs, initTheme, motionOK } from './dom.ts'
import { agentView, type Session, stateAt } from './model.ts'
import { highlight, Reader } from './reader.ts'
import { sampleSession } from './sample.ts'
import { initTryIt } from './try-it.ts'

initTheme()
initTabs()

const hero = new Reader($('#hero-reader'), { variant: 'compact', level: 3 })
const sample = await sampleSession()
hero.load(sample, { pos: motionOK() ? 9 : sample.entries.length })

render(highlight(agentView(sample, stateAt(sample, sample.entries.length))), $('#ws-source'))
render(highlight(agentInstructions(sample)), $('#inst-text'))

if (globalThis.crypto?.subtle) initChainDemo(sample)
initTryIt(hero, sample)

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
