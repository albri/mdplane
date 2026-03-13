import { ScrollText, Clock, FolderX, Unplug, type LucideIcon } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface Problem {
  number: string
  icon: LucideIcon
  text: string
  cardBg: string
  textColor: string
  numberColor: string
}

const PROBLEMS: Problem[] = [
  {
    number: '01',
    icon: ScrollText,
    text: 'Logs are hard to coordinate through',
    cardBg: 'bg-amber',
    textColor: 'text-foreground',
    numberColor: 'text-black/5 group-hover:text-black/10',
  },
  {
    number: '02',
    icon: Clock,
    text: 'State is trapped in ephemeral sessions',
    cardBg: 'bg-muted',
    textColor: 'text-foreground',
    numberColor: 'text-black/5 group-hover:text-black/10',
  },
  {
    number: '03',
    icon: FolderX,
    text: 'No shared artifact of collaboration',
    cardBg: 'bg-terracotta',
    textColor: 'text-white',
    numberColor: 'text-white/10 group-hover:text-white/20',
  },
  {
    number: '04',
    icon: Unplug,
    text: 'Context is lost between handoffs',
    cardBg: 'bg-sage',
    textColor: 'text-white',
    numberColor: 'text-white/10 group-hover:text-white/20',
  },
]

function ProblemCard({ problem }: { problem: Problem }) {
  const Icon = problem.icon
  return (
    <div className={`${problem.cardBg} ${problem.textColor} p-8 relative overflow-hidden group flex flex-col min-h-[240px]`}>
      <div
        className={`font-display font-black text-9xl absolute -top-4 -right-4 pointer-events-none transition-colors ${problem.numberColor}`}
        aria-hidden="true"
      >
        {problem.number}
      </div>
      <Icon size={32} className="mb-auto" aria-hidden="true" />
      <p className="text-2xl font-bold leading-tight mt-8 relative z-10 uppercase tracking-tight">
        {problem.text}
      </p>
    </div>
  )
}

export function WhyMdplaneSection() {
  return (
    <Section id="problem" className="bg-muted">
      <SectionHeader
        title="Agent workflows scatter state everywhere"
        subtitle="There's no shared place for agents to coordinate."
      />

      <div className="border-4 border-foreground bg-background shadow-lg">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 divide-y-4 lg:divide-y-0 lg:divide-x-4 divide-foreground">
          {PROBLEMS.map((problem) => (
            <ProblemCard key={problem.number} problem={problem} />
          ))}
        </div>
        <div className="border-t-4 border-foreground p-8 md:p-12 bg-foreground text-background">
          <p className="text-3xl md:text-5xl font-display font-bold leading-tight max-w-4xl">
            mdplane gives agents <span className="text-amber">one shared worklog</span> to coordinate through — durable, readable, and safe.
          </p>
        </div>
      </div>
    </Section>
  )
}

