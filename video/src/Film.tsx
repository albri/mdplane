import type { ReactNode } from 'react'
import { AbsoluteFill, interpolateColors, Sequence } from 'remotion'
import { ramp, travel, useT, Words } from './motion.tsx'
import { Lockup, Route } from './route.tsx'
import { Claims } from './scenes/claims.tsx'
import { Close } from './scenes/close.tsx'
import { Job } from './scenes/job.tsx'
import { Link } from './scenes/link.tsx'
import { Hero, Why } from './scenes/open.tsx'
import { Watch } from './scenes/watch.tsx'
import type { FilmSession } from './session.ts'
import { c, font, FPS, X } from './theme.ts'

// When each shot starts, in seconds. Each shot's own beats are at the top of its scene.
// Every statement and line of text holds for at least 1s plus 0.25s a word once it has arrived,
// and nothing else moves while a statement arrives.
export const AT = {
  why: 8.6,
  route: 19.5,
  job: 27.7,
  link: 44.8,
  claims: 65.6,
  watch: 98.2,
  close: 129.2,
}
export const DURATION = 136.4
// Each shot starts this much before the last one ends, so one leaves as the next arrives.
const LEAD = 0.3

const Shot = ({ from, to, children }: { from: number; to: number; children: ReactNode }) => (
  <Sequence
    from={Math.round(Math.max(0, from - LEAD) * FPS)}
    durationInFrames={Math.round((to - Math.max(0, from - LEAD)) * FPS)}
  >
    {children}
  </Sequence>
)

function HowItWorks() {
  return (
    <Words
      text="How it works"
      at={0.2}
      exit={6.9}
      size={46}
      style={{ left: X, top: 370, letterSpacing: '-0.02em' }}
    />
  )
}

export type FilmProps = { session: FilmSession }

export function Film({ session }: FilmProps) {
  const t = useT()
  // The page turns to the landing page's sunk grey for the reader, as its stage section does.
  const sunk = ramp(t, AT.watch - 0.8, 0.6, travel) - ramp(t, AT.close, 0.6, travel)
  return (
    <AbsoluteFill
      style={{
        background: interpolateColors(sunk, [0, 1], [c.page, c.sunk]),
        fontFamily: font.sans,
      }}
    >
      <Shot from={0} to={AT.why}>
        <Hero />
      </Shot>
      <Shot from={AT.why} to={AT.route}>
        <Why />
      </Shot>
      <Shot from={AT.route} to={AT.job}>
        <HowItWorks />
      </Shot>
      <Shot from={AT.job} to={AT.link}>
        <Job entries={session.entries} body={session.brief} />
      </Shot>
      <Shot from={AT.link} to={AT.claims}>
        <Link />
      </Shot>
      <Shot from={AT.claims} to={AT.watch}>
        <Claims />
      </Shot>
      <Shot from={AT.watch} to={AT.close}>
        <Watch session={session} />
      </Shot>
      <Shot from={AT.close} to={DURATION}>
        <Close />
      </Shot>
      <Route
        drawAt={[0.9, 1.8, 2.7, 3.6].map((s) => AT.route + s)}
        dockAt={AT.route + 7}
        // A stop fills while the shot before it leaves, so it never moves under a new statement.
        reachAt={[AT.route + 7, AT.link - 0.7, AT.claims - 0.7, AT.watch - 0.7]}
        leaveAt={AT.close}
      />
      <Lockup dockAt={1.6} undockAt={AT.close + 0.3} />
    </AbsoluteFill>
  )
}
