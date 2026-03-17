import { Check } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const TABLE_ROWS = [
  { part: 'Body', purpose: 'Shared context & instructions', mutability: 'Overwritable (write key)' },
  { part: 'Appends', purpose: 'Execution timeline', mutability: 'Append-only (append key)' },
]

const FEATURES = [
  'Files are what agents read for context',
  'Folders keep different kinds of work separate',
  'Events can be scoped to specific paths',
]

export function FilesSection() {
  return (
    <Section className="bg-amber text-foreground">
      <SectionHeader
        title="Files & Folders"
        subtitle="Markdown files hold shared context. Folders group related workflows and keep work organized."
      />

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        <figure className="bg-foreground p-8 border-3 border-border shadow-lg font-mono text-sm md:text-base overflow-x-auto flex flex-col justify-center text-white" aria-label="File structure and API examples">
          <div className="mb-8 text-sage" aria-label="Example folder structure">
            /workflows/<br />
            <span className="pl-4 inline-block">└── pr-review-dispatch.md</span><br />
            /events/<br />
            <span className="pl-4 inline-block">└── incoming-prs.md</span><br />
            /logs/<br />
            <span className="pl-4 inline-block">└── agent-activity.md</span>
          </div>

          <div className="text-terracotta mb-2">PUT /w/KEY/workflows/task-board.md</div>
          <div className="mb-6">{'{ "content": "# Task Board\\n..." }'}</div>

          <div className="text-amber mb-2">GET /r/KEY/workflows/task-board.md</div>
          <div>{'→ { "content": "...", "appendCount": 12 }'}</div>
        </figure>

        <div>
          <h3 className="text-3xl font-display font-bold mb-6">Two parts to every file</h3>

          <div className="bg-background text-foreground border-3 border-border shadow overflow-hidden mb-8" role="table" aria-label="File structure breakdown">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground bg-sage text-white">
                  <th scope="col" className="p-4 font-display font-bold">Part</th>
                  <th scope="col" className="p-4 font-display font-bold border-l-2 border-foreground">Purpose</th>
                  <th scope="col" className="p-4 font-display font-bold border-l-2 border-foreground">How it changes</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {TABLE_ROWS.map((row, i) => (
                  <tr key={row.part} className={i < TABLE_ROWS.length - 1 ? 'border-b border-foreground/20' : ''}>
                    <td className="p-4 font-bold">{row.part}</td>
                    <td className="p-4 border-l-2 border-foreground">{row.purpose}</td>
                    <td className="p-4 border-l-2 border-foreground">{row.mutability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xl font-display font-bold inline-block bg-foreground text-background px-6 py-3 border-3 border-border">
            Markdown only. No binary files. Structure emerges from headings and lists.
          </p>
        </div>
      </div>

      <ul className="flex flex-col md:flex-row md:flex-wrap gap-4 md:justify-center" role="list">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-3 bg-background text-foreground px-6 py-3 border-3 border-border shadow-sm">
            <Check size={20} className="text-terracotta flex-shrink-0" aria-hidden="true" />
            <span className="font-bold">{feature}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
