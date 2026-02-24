import { Bot, Eye, Layers } from 'lucide-react'

import { SectionHeading } from '@/components/section-heading'

type WhyMarkdownSectionProps = {
  className?: string
}

const WHY_MARKDOWN_POINTS = [
  {
    title: 'Agents already understand it',
    description: 'Markdown is the format agents are most reliable at reading, writing, and reasoning over.',
    icon: Bot,
  },
  {
    title: 'Human-readable without tooling',
    description: 'Inspect and edit the same artifact your agents use — no specialized viewer required.',
    icon: Eye,
  },
  {
    title: 'No schema to define',
    description: 'Start writing immediately. Structure emerges from headings and appends.',
    icon: Layers,
  },
] as const

export function WhyMarkdownSection({ className }: WhyMarkdownSectionProps) {
  return (
    <section className={className}>
      <SectionHeading>WHY MARKDOWN?</SectionHeading>
      <p className="mt-6 text-lg text-foreground">
        Markdown is the de facto interface language for agent and human collaboration.
      </p>

      <div className="mt-8 space-y-3">
        {WHY_MARKDOWN_POINTS.map((point) => (
          <div key={point.title} className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <point.icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{point.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

