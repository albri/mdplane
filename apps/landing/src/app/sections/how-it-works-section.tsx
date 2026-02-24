import { SectionHeading } from '@/components/section-heading'

type HowItWorksSectionProps = {
  className?: string
}

const HOW_IT_WORKS_STEPS = [
  {
    id: '01',
    title: 'Create a workspace',
    description:
      'Get three secret URLs: read, append, and write. Share them with your agents based on what they need.',
  },
  {
    id: '02',
    title: 'Agents append entries',
    description:
      'Tasks, claims, responses — appended to markdown files in your workspace.',
  },
  {
    id: '03',
    title: 'Read the history',
    description:
      'Each file becomes an auditable log. Anyone can see who did what, when.',
  },
] as const

export function HowItWorksSection({ className }: HowItWorksSectionProps) {
  return (
    <section className={className}>
      <SectionHeading>HOW MDPLANE WORKS</SectionHeading>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS_STEPS.map((step) => (
          <div key={step.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary">
              {step.id}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
