import { Users, Terminal, Check, LucideIcon } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface ReaderType {
  title: string
  icon: LucideIcon
  iconBg: string
  url: string
  urlStyle: string
  subtitle: string
  description: string
  borderColor: string
  cardStyle: string
}

const READER_TYPES: ReaderType[] = [
  {
    title: 'Humans',
    icon: Users,
    iconBg: 'bg-amber',
    url: 'app.mdplane.dev/r/x7k9p2',
    urlStyle: 'bg-muted',
    subtitle: 'Beautifully formatted',
    description: 'Rich typography, syntax highlighting, and a clean reading experience.',
    borderColor: 'border-foreground',
    cardStyle: 'bg-card',
  },
  {
    title: 'Agents',
    icon: Terminal,
    iconBg: 'bg-sage',
    url: 'api.mdplane.dev/r/x7k9p2/raw',
    urlStyle: 'bg-card/10 text-amber',
    subtitle: 'Raw markdown or JSON',
    description: 'Clean text ready for context windows, or structured JSON for parsing.',
    borderColor: 'border-sage',
    cardStyle: 'bg-foreground text-background',
  },
]

const FEATURES = ['Same key, different endpoints', 'Persistent context — survives sessions', 'Update the file, everyone gets the latest']

function ReaderCard({ reader }: { reader: ReaderType }) {
  const Icon = reader.icon
  return (
    <article className={`${reader.cardStyle} p-8 border-3 border-border shadow`}>
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-12 h-12 ${reader.iconBg} border-3 border-border flex items-center justify-center ${reader.cardStyle.includes('foreground') ? 'text-foreground' : ''}`}>
          <Icon size={24} aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-display font-bold">{reader.title}</h3>
      </div>
      <code className={`${reader.urlStyle} p-4 border-3 border-border mb-6 font-mono text-sm break-all block`}>{reader.url}</code>
      <div className={`border-l-4 ${reader.borderColor} pl-6 py-2`}>
        <h4 className="font-display font-bold text-xl mb-2">{reader.subtitle}</h4>
        <p className="opacity-80">{reader.description}</p>
      </div>
    </article>
  )
}

export function ReadersSection() {
  return (
    <Section className="bg-background">
      <SectionHeader title="Anyone with the key can read" subtitle="Humans and agents each get what they need." />

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        {READER_TYPES.map((reader) => (
          <ReaderCard key={reader.title} reader={reader} />
        ))}
      </div>

      <ul className="flex flex-col md:flex-row flex-wrap gap-4 md:justify-center" role="list">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-3 bg-card px-6 py-3 border-3 border-border shadow-sm w-full md:w-auto">
            <Check size={20} className="text-terracotta flex-shrink-0" aria-hidden="true" />
            <span className="font-bold">{feature}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

