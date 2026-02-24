import { advancedFeatures } from '../content'
import { SectionHeading } from '@/components/section-heading'

type AdvancedFeaturesSectionProps = {
  className?: string
}

export function AdvancedFeaturesSection({ className }: AdvancedFeaturesSectionProps) {
  return (
    <section className={className}>
      <SectionHeading>AS YOU SCALE</SectionHeading>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm md:grid-cols-4">
        {advancedFeatures.map((feature) => {
          const Icon = feature.icon
          return (
            <div key={feature.title} className="bg-card p-4">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{feature.description}</p>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Plus audit logs, heartbeats, API keys, and more.
      </p>
    </section>
  )
}
