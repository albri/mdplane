import { Section, SectionHeader } from '../ui/section'

const appendTypes = [
  { name: "task", color: "bg-foreground text-white" },
  { name: "claim", color: "bg-amber text-foreground" },
  { name: "response", color: "bg-sage text-foreground" },
  { name: "blocked", color: "bg-red-500 text-white" },
  { name: "answer", color: "bg-blue-500 text-white" },
  { name: "comment", color: "bg-white text-foreground" },
  { name: "renew", color: "bg-white text-foreground" },
  { name: "cancel", color: "bg-white text-foreground" },
  { name: "vote", color: "bg-white text-foreground" },
  { name: "heartbeat", color: "bg-white text-foreground" }
]

export function AppendModelSection() {
  return (
    <Section className="bg-terracotta text-white">
      <SectionHeader 
        title="The append model" 
        subtitle="Now that agents can read and be triggered — how do they contribute safely?" 
      />
      
      <div className="bg-background text-foreground border-3 border-border shadow-lg mb-12">
        <div className="p-6 border-b-3 border-foreground bg-white">
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
            <div className="bg-white p-3 border-3 border-border flex gap-3">
              <span className="text-terracotta font-bold">[task]</span>
              <span>Review API requirements</span>
            </div>
            <div className="bg-white p-3 border-3 border-border flex gap-3 ml-8">
              <span className="text-amber font-bold">[claim]</span>
              <span>Agent-Alpha working on this</span>
            </div>
            <div className="bg-white p-3 border-3 border-border flex gap-3 ml-8">
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
        {appendTypes.map((tag, i) => (
          <div key={i} className={`${tag.color} px-4 py-2 font-mono font-bold border-3 border-border`}>
            [{tag.name}]
          </div>
        ))}
      </div>
      
      <div className="inline-block bg-foreground px-6 py-4 border-3 border-border">
        <p className="text-xl font-bold font-display">Every entry is timestamped and attributed to an author.</p>
      </div>
    </Section>
  )
}

