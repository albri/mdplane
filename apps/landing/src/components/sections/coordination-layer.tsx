import { Folder, FileText, Zap, RefreshCw, type LucideIcon } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface LayerItem {
  title: string
  desc: string
  icon: LucideIcon
  cardBg: string
  textColor?: string
  iconColor?: string
}

const LAYER_ITEMS: LayerItem[] = [
  {
    title: 'Workspace',
    desc: 'A durable container for agent collaboration and shared context.',
    icon: Folder,
    cardBg: 'bg-sage',
    textColor: 'text-white',
  },
  {
    title: 'Files',
    desc: 'Markdown artifacts agents read for context and task state.',
    icon: FileText,
    cardBg: 'bg-amber',
  },
  {
    title: 'Appends',
    desc: 'Immutable entries agents add to the log to coordinate work.',
    icon: Zap,
    cardBg: 'bg-terracotta',
    textColor: 'text-white',
  },
  {
    title: 'Events',
    desc: 'Real-time streams that notify when the worklog changes.',
    icon: RefreshCw,
    cardBg: 'bg-card',
    iconColor: 'bg-black/5',
  },
]

function LayerCard({ item }: { item: LayerItem }) {
  const Icon = item.icon
  const iconBg = item.iconColor || 'bg-white/20'
  return (
    <div className={`${item.cardBg} ${item.textColor || ''} p-8 border-3 border-border shadow`}>
      <div
        className={`${iconBg} w-12 h-12 border-3 border-border flex items-center justify-center mb-6`}
        aria-hidden="true"
      >
        <Icon size={24} className="text-foreground" />
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

