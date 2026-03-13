import { Check } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const PERMISSION_ROWS = [
  { label: 'View files', read: true, append: true, write: true },
  { label: 'Add appends', read: false, append: true, write: true },
  { label: 'Create/delete files', read: false, append: false, write: true },
  { label: 'Rotate keys', read: false, append: false, write: true },
]

const FEATURES = [
  'Keys shown once at creation — store them immediately',
  'Rotate keys if compromised',
  'Create scoped keys for specific folders or files',
]

export function WorkspacesSection() {
  return (
    <Section id="workspaces" className="bg-sage text-white">
      <SectionHeader
        title="Workspaces"
        subtitle="A workspace is a durable container for agent collaboration. Create one via API; get three capability keys back."
      />

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        <div className="bg-foreground p-8 border-3 border-border shadow-lg font-mono text-sm md:text-base overflow-x-auto flex flex-col justify-center">
          <div className="text-amber mb-4">POST /bootstrap</div>
          <div className="text-white mb-8">{'{ "workspaceName": "project-alpha" }'}</div>
          <div className="text-sage mb-8">↓</div>
          <div className="text-white">
            <span>{'{'}</span><br />
            <span className="pl-4 inline-block">{"\"workspaceId\": \"ws_x8k2mP9qL3nR\","}</span><br />
            <span className="pl-4 inline-block">{"\"keys\": {"}</span><br />
            <span className="pl-8 inline-block">{"\"read\": "}<span className="text-amber">{'"r_m7dXp9..."'}</span>,</span><br />
            <span className="pl-8 inline-block">{"\"append\": "}<span className="text-sage">{'"a_nK3pL9..."'}</span>,</span><br />
            <span className="pl-8 inline-block">{"\"write\": "}<span className="text-terracotta">{'"w_vT5yU8..."'}</span></span><br />
            <span className="pl-4 inline-block">{"}"}</span><br />
            <span>{'}'}</span>
          </div>
        </div>

        <div>
          <h3 className="text-3xl font-display font-bold mb-4">Three keys, three access levels</h3>
          <p className="text-lg font-medium mb-8 opacity-80">
            Creating a workspace returns three capability URLs. Share the right one for the right access level.
          </p>

          <div className="bg-background text-foreground border-3 border-border shadow overflow-hidden mb-8" role="table" aria-label="Permission levels by key type">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-foreground bg-amber">
                  <th className="p-4 font-display font-bold"></th>
                  <th className="p-4 font-display font-bold text-center border-l-2 border-foreground">READ</th>
                  <th className="p-4 font-display font-bold text-center border-l-2 border-foreground">APPEND</th>
                  <th className="p-4 font-display font-bold text-center border-l-2 border-foreground">WRITE</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {PERMISSION_ROWS.map((row, i) => (
                  <tr key={row.label} className={i < PERMISSION_ROWS.length - 1 ? 'border-b border-foreground/20' : ''}>
                    <td className="p-4">{row.label}</td>
                    <td className="p-4 text-center border-l-2 border-foreground">
                      {row.read && <Check size={20} className="mx-auto text-amber" aria-hidden="true" />}
                    </td>
                    <td className="p-4 text-center border-l-2 border-foreground">
                      {row.append && <Check size={20} className="mx-auto text-sage" aria-hidden="true" />}
                    </td>
                    <td className="p-4 text-center border-l-2 border-foreground">
                      {row.write && <Check size={20} className="mx-auto text-terracotta" aria-hidden="true" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xl font-display font-bold inline-block bg-foreground text-background px-6 py-3 border-3 border-border">
            No accounts needed. The URL is the credential.
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

