import { Section, SectionHeader } from '../ui/section'
import {
  Circle,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  CornerUpRight,
  MessageCircle,
  RotateCw,
  X,
  Heart,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react'

interface AppendType {
  name: string
  color: string
  icon: LucideIcon
}

const APPEND_TYPES: AppendType[] = [
  { name: 'task', color: 'bg-badge-task text-background', icon: Circle },
  { name: 'claim', color: 'bg-badge-claim text-foreground', icon: CircleDot },
  { name: 'response', color: 'bg-badge-response text-foreground', icon: CheckCircle2 },
  { name: 'blocked', color: 'bg-badge-blocked text-white', icon: AlertTriangle },
  { name: 'answer', color: 'bg-badge-answer text-white', icon: CornerUpRight },
  { name: 'comment', color: 'bg-badge-comment text-foreground border border-foreground', icon: MessageCircle },
  { name: 'renew', color: 'bg-badge-renew text-white', icon: RotateCw },
  { name: 'cancel', color: 'bg-badge-cancel text-white', icon: X },
  { name: 'vote', color: 'bg-badge-vote text-white', icon: Heart },
  { name: 'heartbeat', color: 'bg-badge-heartbeat text-white', icon: HeartPulse },
]

interface ExampleAppend {
  type: string
  typeColor: string
  content: string
  indented?: boolean
}

const EXAMPLE_APPENDS: ExampleAppend[] = [
  { type: 'task', typeColor: 'text-terracotta', content: 'Review API requirements' },
  { type: 'claim', typeColor: 'text-amber', content: 'Agent-Alpha working on this', indented: true },
  { type: 'response', typeColor: 'text-sage', content: 'Done. Review completed. No issues found.', indented: true },
]

function AppendBadge({ appendType }: { appendType: AppendType }) {
  const Icon = appendType.icon
  return (
    <span className={`${appendType.color} px-4 py-2 font-mono font-bold border-3 border-border inline-flex items-center gap-2`}>
      <Icon className="size-5" aria-hidden="true" />
      [{appendType.name}]
    </span>
  )
}

export function AppendModelSection() {
  return (
    <Section className="bg-terracotta text-white">
      <SectionHeader title="The append model" subtitle="Agents can read your workspace — but how do they contribute safely?" />

      <figure className="bg-background text-foreground border-3 border-border shadow-lg mb-12" aria-label="Example of append model">
        <div className="p-6 border-b-3 border-foreground bg-card">
          <p className="font-bold font-display uppercase tracking-widest text-sm text-sage mb-4">Main Document (Write Key)</p>
          <div className="font-mono text-lg space-y-2">
            <p className="text-3xl font-bold font-display mb-4"># Project Spec</p>
            <p>We need to build a new API endpoint for user authentication.</p>
            <p>Requirements:</p>
            <ul className="list-disc pl-6">
              <li>Rate limiting</li>
              <li>JWT tokens</li>
            </ul>
          </div>
        </div>

        <div className="p-6 bg-muted">
          <p className="font-bold font-display uppercase tracking-widest text-sm text-terracotta mb-4">Appends (Append Key)</p>
          <ul className="space-y-3 font-mono" role="list">
            {EXAMPLE_APPENDS.map((append, i) => (
              <li key={i} className={`bg-card p-3 border-3 border-border flex gap-3 ${append.indented ? 'ml-4 md:ml-8' : ''}`}>
                <span className={`${append.typeColor} font-bold`}>[{append.type}]</span>
                <span>{append.content}</span>
              </li>
            ))}
          </ul>
        </div>
      </figure>

      <p className="text-2xl font-medium mb-10 max-w-4xl leading-relaxed">
        Appends live at the end of the file — structured entries that accumulate. Safe contributions: agents can add, but can&apos;t
        modify or delete.
      </p>

      <ul className="flex flex-wrap gap-3 mb-12" role="list" aria-label="Append types">
        {APPEND_TYPES.map((appendType) => (
          <li key={appendType.name}>
            <AppendBadge appendType={appendType} />
          </li>
        ))}
      </ul>

      <div className="inline-block bg-foreground px-6 py-4 border-3 border-border">
        <p className="text-xl font-bold font-display">Every entry is timestamped and attributed to an author.</p>
      </div>
    </Section>
  )
}

