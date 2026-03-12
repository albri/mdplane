import { Zap, FileText, Shield, Terminal, LucideIcon } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface Feature {
  icon: LucideIcon
  text: string
}

const FEATURES: Feature[] = [
  { icon: Zap, text: 'Share it instantly, no account required' },
  { icon: FileText, text: 'See it formatted nicely, no friction' },
  { icon: Shield, text: 'Share it securely, with access control' },
  { icon: Terminal, text: 'Let agents read it — or even coordinate around it' },
]

function FeatureItem({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  return (
    <li className="flex items-start gap-4 p-6 bg-card border-3 border-border shadow-sm">
      <div className="bg-amber p-2 border-3 border-border" aria-hidden="true">
        <Icon size={24} />
      </div>
      <p className="text-xl font-medium pt-1">{feature.text}</p>
    </li>
  )
}

export function WhyMdplaneSection() {
  return (
    <Section id="why" className="bg-muted">
      <SectionHeader title="Why mdplane?" subtitle="You have markdown you want to share — a spec, a runbook, some notes." />

      <div className="grid md:grid-cols-2 gap-12">
        <ul className="space-y-6" role="list">
          {FEATURES.map((feature) => (
            <FeatureItem key={feature.text} feature={feature} />
          ))}
        </ul>

        <aside className="flex items-center justify-center p-8 bg-sage border-3 border-border shadow">
          <p className="text-3xl font-display font-bold text-white leading-tight">
            mdplane gives your markdown a workspace — secure, shareable, readable by humans and agents alike.
          </p>
        </aside>
      </div>
    </Section>
  )
}

