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
  type LucideIcon
} from 'lucide-react'

const appendTypes: { name: string; color: string; icon: LucideIcon }[] = [
  { name: "task", color: "bg-badge-task text-background", icon: Circle },
  { name: "claim", color: "bg-badge-claim text-foreground", icon: CircleDot },
  { name: "response", color: "bg-badge-response text-foreground", icon: CheckCircle2 },
  { name: "blocked", color: "bg-badge-blocked text-white", icon: AlertTriangle },
  { name: "answer", color: "bg-badge-answer text-white", icon: CornerUpRight },
  { name: "comment", color: "bg-badge-comment text-foreground border border-foreground", icon: MessageCircle },
  { name: "renew", color: "bg-badge-renew text-white", icon: RotateCw },
  { name: "cancel", color: "bg-badge-cancel text-white", icon: X },
  { name: "vote", color: "bg-badge-vote text-white", icon: Heart },
  { name: "heartbeat", color: "bg-badge-heartbeat text-white", icon: HeartPulse }
]

export function AppendModelSection() {
  return (
    <Section className="bg-terracotta text-white">
      <SectionHeader 
        title="The append model" 
        subtitle="Now that agents can read and be triggered — how do they contribute safely?" 
      />
      
      <div className="bg-background text-foreground border-3 border-border shadow-lg mb-12">
        <div className="p-6 border-b-3 border-foreground bg-card">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold font-display uppercase tracking-widest text-sm text-sage">Main Document (Write Key)</span>
          </div>
          <div className="font-mono text-lg space-y-2">
            <h1 className="text-3xl font-bold font-display mb-4"># Project Spec</h1>
            <p>We need to build a new API endpoint for user authentication.</p>
            <p>Requirements:</p>
            <ul className="list-disc pl-6">
              <li>Rate limiting</li>
              <li>JWT tokens</li>
            </ul>
          </div>
        </div>
        
        <div className="p-6 bg-muted">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold font-display uppercase tracking-widest text-sm text-terracotta">Appends (Append Key)</span>
          </div>
          <div className="space-y-3 font-mono">
            <div className="bg-card p-3 border-3 border-border flex gap-3">
              <span className="text-terracotta font-bold">[task]</span>
              <span>Review API requirements</span>
            </div>
            <div className="bg-card p-3 border-3 border-border flex gap-3 ml-8">
              <span className="text-amber font-bold">[claim]</span>
              <span>Agent-Alpha working on this</span>
            </div>
            <div className="bg-card p-3 border-3 border-border flex gap-3 ml-8">
              <span className="text-sage font-bold">[response]</span>
              <span>Done. Review completed. No issues found.</span>
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-2xl font-medium mb-10 max-w-4xl leading-relaxed">
        Appends live at the end of the file — structured entries that accumulate. Safe contributions: agents can add, but can&apos;t modify or delete.
      </p>
      
      <div className="flex flex-wrap gap-3 mb-12">
        {appendTypes.map((tag, i) => {
          const Icon = tag.icon
          return (
            <div key={i} className={`${tag.color} px-4 py-2 font-mono font-bold border-3 border-border flex items-center gap-2`}>
              <Icon className="size-5" />
              [{tag.name}]
            </div>
          )
        })}
      </div>
      
      <div className="inline-block bg-foreground px-6 py-4 border-3 border-border">
        <p className="text-xl font-bold font-display">Every entry is timestamped and attributed to an author.</p>
      </div>
    </Section>
  )
}

