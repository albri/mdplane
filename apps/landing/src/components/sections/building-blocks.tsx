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
    desc: 'A shared workspace for agent collaboration and context.',
    icon: Folder,
    cardBg: 'bg-sage',
    textColor: 'text-white',
  },
  {
    title: 'Files',
    desc: 'Markdown files agents read for context and task state.',
    icon: FileText,
    cardBg: 'bg-amber',
  },
  {
    title: 'Appends',
    desc: 'Append-only entries agents add to the worklog.',
    icon: Zap,
    cardBg: 'bg-terracotta',
    textColor: 'text-white',
  },
  {
    title: 'Events',
    desc: 'Events that tell your watcher when the worklog changes.',
    icon: RefreshCw,
    cardBg: 'bg-card',
    iconColor: 'bg-black/5',
  },
]

function LayerCard({ item }: { item: LayerItem }) {
  const Icon = item.icon
  const iconBg = item.iconColor || 'bg-white/20'
  return (
    <div className={`${item.cardBg} ${item.textColor || ''} p-8 border-3 border-border shadow h-full`}>
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

export function BuildingBlocksSection() {
  return (
    <Section id="how-it-works" className="bg-background">
      <SectionHeader
        title="The building blocks"
        subtitle="Four simple pieces make up mdplane: a workspace, markdown files, appends, and events."
      />
      <ul className="grid md:grid-cols-2 lg:grid-cols-4 gap-8" role="list">
        {LAYER_ITEMS.map((item) => (
          <li key={item.title}>
            <LayerCard item={item} />
          </li>
        ))}
      </ul>
    </Section>
  )
}
