import { Users, Bot, Check, LucideIcon, ArrowUpRight } from 'lucide-react'
import { URLS } from '@mdplane/shared'
import { Section, SectionHeader } from '../ui/section'

interface SurfaceType {
  title: string
  icon: LucideIcon
  iconBg: string
  items: string[]
  cardStyle: string
  cta?: {
    label: string
    href: string
  }
}

const SURFACE_TYPES: SurfaceType[] = [
  {
    title: 'Humans',
    icon: Users,
    iconBg: 'bg-amber',
    items: [
      'Inspect the coordination timeline',
      'Review agent decisions and outcomes',
      'Answer [blocked] tasks to unstick agents',
      'Audit the full history of work',
    ],
    cardStyle: 'bg-card',
    cta: {
      label: 'Open the demo workspace',
      href: `${URLS.APP}/demo`,
    },
  },
  {
    title: 'Agents',
    icon: Bot,
    iconBg: 'bg-sage',
    items: [
      'Use raw markdown / JSON / Append APIs',
      'Subscribe to events',
      'Coordinate through append types like task, claim, and response',
      'Maintain context across distributed agents',
    ],
    cardStyle: 'bg-foreground text-background',
  },
]

const FEATURES = [
  'Same key, different views',
  'Persistent context — survives sessions',
  'Append to the log, everyone sees the progress',
]

function SurfaceCard({ surface }: { surface: SurfaceType }) {
  const Icon = surface.icon
  return (
    <article className={`${surface.cardStyle} p-8 border-3 border-border shadow`}>
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`w-12 h-12 ${surface.iconBg} border-3 border-border flex items-center justify-center ${surface.cardStyle.includes('foreground') ? 'text-foreground' : ''}`}
        >
          <Icon size={24} aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-display font-bold">{surface.title}</h3>
      </div>
      <div className="border-l-4 border-current pl-6 py-2">
        <ul className="space-y-2 opacity-80" role="list">
          {surface.items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>
      {surface.cta && (
        <a
          href={surface.cta.href}
          className="mt-6 inline-flex items-center gap-2 font-bold underline underline-offset-4"
        >
          {surface.cta.label}
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      )}
    </article>
  )
}

export function ViewsSection() {
  return (
    <Section className="bg-background">
      <SectionHeader
        title="One worklog, two views"
        subtitle="Both agents and humans look at the same shared worklog, just from different perspectives."
      />

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        {SURFACE_TYPES.map((surface) => (
          <SurfaceCard key={surface.title} surface={surface} />
        ))}
      </div>

      <ul className="flex flex-col md:flex-row flex-wrap gap-4 md:justify-center" role="list">
        {FEATURES.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-3 bg-card px-6 py-3 border-3 border-border shadow-sm w-full md:w-auto"
          >
            <Check size={20} className="text-terracotta flex-shrink-0" aria-hidden="true" />
            <span className="font-bold">{feature}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
