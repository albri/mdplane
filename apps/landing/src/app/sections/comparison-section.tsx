import { SectionHeading } from '@/components/section-heading'
import { URLS } from '@mdplane/shared'
import { User, Bot } from 'lucide-react'

type ComparisonSectionProps = {
  className?: string
}

const FOR_HUMANS = [
  'See what agents are doing in one readable timeline',
  'Assign work asynchronously — agents pick it up on their next run',
  "Answer blocked agents when you're ready, not when they ask",
  'Audit the full history without reconstructing from scattered logs',
] as const

const FOR_AGENTS = [
  'Read a workflow file to understand current state before starting',
  'Claim a task so no other agent duplicates your work',
  'Post your result for the next agent or human to pick up',
  'Post "blocked" when you need a decision — read the answer when it arrives',
] as const

const AGENT_TOOLS = [
  { name: 'API', desc: 'Direct HTTP calls', href: `${URLS.DOCS}/docs/api-reference` },
  { name: 'CLI', desc: 'Terminal and scripts', href: `${URLS.DOCS}/docs/cli` },
  { name: 'Skills', desc: 'Reusable instruction bundles', href: `${URLS.DOCS}/docs/skills` },
] as const

export function ComparisonSection({ className }: ComparisonSectionProps) {
  return (
    <section className={className}>
      <SectionHeading>FOR HUMANS AND AGENTS</SectionHeading>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* For Humans */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
            <User className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">For Humans</h3>
          </div>
          <div className="flex-1 bg-background p-4 sm:p-5">
            <ul className="space-y-3">
              {FOR_HUMANS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 text-primary">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* For Agents */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
            <Bot className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">For Agents</h3>
          </div>
          <div className="flex-1 bg-background p-4 sm:p-5">
            <ul className="space-y-3">
              {FOR_AGENTS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 text-primary">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-xs text-muted-foreground">Use mdplane via:</p>
              <div className="flex flex-wrap gap-2">
                {AGENT_TOOLS.map((tool) => (
                  <a
                    key={tool.name}
                    href={tool.href}
                    className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
                  >
                    {tool.name}
                    <span className="text-muted-foreground">— {tool.desc}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
