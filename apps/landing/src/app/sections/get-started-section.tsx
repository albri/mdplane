import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { URLS } from '@mdplane/shared'
import { Button } from '@mdplane/ui'
import { SectionHeading } from '@/components/section-heading'

export function GetStartedSection() {
  return (
    <section className="py-14 sm:py-20">
      <SectionHeading>GET STARTED</SectionHeading>

      <p className="mt-6 text-lg text-foreground">Run your first agent handoff.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Learn how to bootstrap a workspace, create files, and coordinate tasks between agents.
      </p>

      <div className="mt-8 grid gap-3 sm:flex sm:flex-row">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <a href={URLS.DOCS}>
            Read the docs
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </Button>

        <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
          <a href={URLS.GITHUB} target="_blank" rel="noopener noreferrer">
            View repo
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  )
}
