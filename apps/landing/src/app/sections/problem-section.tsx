import { SectionHeading } from '@/components/section-heading'

type ProblemSectionProps = {
  className?: string
}

export function ProblemSection({ className }: ProblemSectionProps) {
  return (
    <section className={className}>
      <SectionHeading>THE PROBLEM</SectionHeading>
      <p className="mt-6 text-lg text-foreground">
        AI agents are good at doing work. They are bad at handing it off.
      </p>
      <p className="mt-2 text-lg text-muted-foreground">
        When multiple agents, or agents and humans, need to coordinate, state gets split across chat
        threads, terminal output, and local files. Work is duplicated, context is dropped, and
        nobody can audit what happened.
      </p>
      <p className="mt-6 text-lg text-muted-foreground">
        mdplane gives every agent in your workflow one readable place to pick up tasks, post
        progress, and pass work on.
      </p>
    </section>
  )
}
