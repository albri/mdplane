import { Folder, FileText, Zap, RefreshCw, type LucideIcon } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface LayerItem {
  title: string
  desc: string
  icon: LucideIcon
  color: string
}

const LAYER_ITEMS: LayerItem[] = [
  {
    title: 'Workspace',
    desc: 'A durable container for agent collaboration and shared context.',
    icon: Folder,
    color: 'bg-amber',
  },
  {
    title: 'Files',
    desc: 'Markdown artifacts agents read for context and task state.',
    icon: FileText,
    color: 'bg-sage',
  },
  {
    title: 'Appends',
    desc: 'Immutable entries agents add to the log to coordinate work.',
    icon: Zap,
    color: 'bg-terracotta',
  },
  {
    title: 'Watchers',
    desc: 'Triggers that react to worklog changes and spawn agents in real time.',
    icon: RefreshCw,
    color: 'bg-foreground text-background',
  },
]

function LayerCard({ item }: { item: LayerItem }) {
  const Icon = item.icon
  return (
    <div className="bg-card p-8 border-3 border-border shadow-sm">
      <div
        className={`${item.color} w-12 h-12 border-3 border-border flex items-center justify-center mb-6`}
        aria-hidden="true"
      >
        <Icon size={24} />
      </div>
      <h3 className="text-2xl font-display font-bold mb-3">{item.title}</h3>
      <p className="opacity-80">{item.desc}</p>
    </div>
  )
}

export function CoordinationLayerSection() {
  return (
    <Section className="bg-background">
      <SectionHeader
        title="The coordination layer"
        subtitle="mdplane combines shared artifacts, append-only coordination, and watchers into one readable layer for agent workflows."
      />
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {LAYER_ITEMS.map((item) => (
          <LayerCard key={item.title} item={item} />
        ))}
      </div>
    </Section>
  )
}

