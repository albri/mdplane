import { MessageSquareOff, Clock, FileQuestion, Unplug, LucideIcon } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface Problem {
  icon: LucideIcon
  text: string
}

const PROBLEMS: Problem[] = [
  { icon: MessageSquareOff, text: 'Logs are hard to coordinate through' },
  { icon: Clock, text: 'State is trapped in ephemeral sessions' },
  { icon: FileQuestion, text: 'No shared artifact of collaboration' },
  { icon: Unplug, text: 'Context is lost between handoffs' },
]

function ProblemItem({ problem }: { problem: Problem }) {
  const Icon = problem.icon
  return (
    <li className="flex items-start gap-4 p-6 bg-card border-3 border-border shadow-sm">
      <div className="bg-amber p-2 border-3 border-border" aria-hidden="true">
        <Icon size={24} />
      </div>
      <p className="text-xl font-medium pt-1">{problem.text}</p>
    </li>
  )
}

export function WhyMdplaneSection() {
  return (
    <Section id="problem" className="bg-muted">
      <SectionHeader
        title="Agent workflows scatter state everywhere"
        subtitle="Prompts disappear with the session. Queues transport tasks but don't preserve shared context. Local files don't travel across agents."
      />

      <div className="grid md:grid-cols-2 gap-12">
        <ul className="space-y-6" role="list">
          {PROBLEMS.map((problem) => (
            <ProblemItem key={problem.text} problem={problem} />
          ))}
        </ul>

        <aside className="flex items-center justify-center p-8 bg-sage border-3 border-border shadow">
          <p className="text-3xl font-display font-bold text-white leading-tight">
            mdplane gives agents one shared worklog to coordinate through — durable, readable, and safe.
          </p>
        </aside>
      </div>
    </Section>
  )
}

