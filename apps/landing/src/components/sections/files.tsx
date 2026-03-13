import { Check } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const TABLE_ROWS = [
  { part: 'Body', purpose: 'Durable context & instructions', mutability: 'Overwritable (write key)' },
  { part: 'Appends', purpose: 'Execution timeline', mutability: 'Append-only (append key)' },
]

const FEATURES = [
  'Files are the artifacts agents read for context',
  'Folders organize workflow lanes and permissions',
  'Watchers can subscribe to specific paths',
]

export function FilesSection() {
  return (
    <Section className="bg-amber text-foreground">
      <SectionHeader
        title="Files & Folders"
        subtitle="Markdown artifacts that store durable context. The body holds instructions; appends hold the execution timeline."
      />

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        {/* Left: Code block */}
        <div className="bg-foreground p-8 border-3 border-border shadow-lg font-mono text-sm md:text-base overflow-x-auto flex flex-col justify-center text-white">
          {/* File tree */}
          <div className="mb-8 text-sage">
            /workflows/<br />
            <span className="pl-4 inline-block">└── pr-review-dispatch.md</span><br />
            /events/<br />
            <span className="pl-4 inline-block">└── incoming-prs.md</span><br />
            /logs/<br />
            <span className="pl-4 inline-block">└── agent-activity.md</span>
          </div>

          {/* PUT example */}
          <div className="text-terracotta mb-2">PUT /w/KEY/workflows/task-board.md</div>
          <div className="mb-6">{'{ "content": "# Task Board\\n..." }'}</div>

          {/* GET example */}
          <div className="text-amber mb-2">GET /r/KEY/workflows/task-board.md</div>
          <div>{'→ { "content": "...", "appendCount": 12 }'}</div>
        </div>

        {/* Right: Two parts explanation */}
        <div>
          <h3 className="text-3xl font-display font-bold mb-6">Two parts to every file</h3>

          {/* Table */}
          <div className="bg-background text-foreground border-3 border-border shadow overflow-hidden mb-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground bg-sage text-white">
                  <th className="p-4 font-display font-bold">Part</th>
                  <th className="p-4 font-display font-bold border-l-2 border-foreground">Purpose</th>
                  <th className="p-4 font-display font-bold border-l-2 border-foreground">Mutability</th>
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

      {/* Bottom features */}
      <div className="flex flex-col md:flex-row md:flex-wrap gap-4 md:justify-center">
        {FEATURES.map((feature) => (
          <div key={feature} className="flex items-center gap-3 bg-background text-foreground px-6 py-3 border-3 border-border shadow-sm">
            <Check size={20} className="text-terracotta flex-shrink-0" aria-hidden="true" />
            <span className="font-bold">{feature}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

