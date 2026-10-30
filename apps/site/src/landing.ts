// The landing page: the sample session replaying under the route, the figures each chapter draws
// from it, the chain demo and the Try it dialog.
import { instructions, renderInstructions } from '@mdplane/contract/core'
import { render } from 'lit-html'
import { initChainDemo } from './chain-demo.ts'
import { $, initTheme, motionOK } from './dom.ts'
import { agentView, type Session, stateAt } from './model.ts'
import { highlight, Reader } from './reader.ts'
import { sampleSession } from './sample.ts'
import { initTryIt } from './try-it.ts'

initTheme()

const hero = new Reader($('#hero-reader'), { variant: 'compact', level: 3 })
const sample = await sampleSession()
hero.load(sample, { pos: motionOK() ? 9 : sample.entries.length })

render(highlight(agentView(sample, stateAt(sample, sample.entries.length))), $('#ws-source'))
render(highlight(reflow(agentInstructions(sample))), $('#inst-text'))

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

// The instructions are hard-wrapped at 80 columns, and wrapped again to a phone's width each of
// those breaks would leave a word or two on a line of its own. So a paragraph's lines are joined
// for the screen to wrap; code keeps its lines, and the words are the agent's.
function reflow(text: string): string {
  const out: string[] = []
  let fenced = false
  // The indent a paragraph's further lines have, while one is open.
  let hang = -1
  for (const line of text.split('\n')) {
    const rest = line.trimStart()
    const indent = line.length - rest.length
    if (rest.startsWith('```')) fenced = !fenced
    const marker = /^(?:- |\d+\. )/.exec(rest)?.[0]
    if (fenced || rest === '' || rest.startsWith('#') || rest.startsWith('```')) {
      out.push(line)
      hang = -1
    } else if (!marker && indent === hang) {
      out[out.length - 1] += ` ${rest}`
    } else {
      out.push(line)
      hang = indent + (marker?.length ?? 0)
    }
  }
  return out.join('\n')
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
