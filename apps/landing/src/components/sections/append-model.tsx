import { Section, SectionHeader } from '../ui/section'

const appendTypes = [
  { name: "task", color: "bg-[#1A1A1A] text-white" },
  { name: "claim", color: "bg-[#E8A851] text-[#1A1A1A]" },
  { name: "response", color: "bg-[#8B9A8B] text-[#1A1A1A]" },
  { name: "blocked", color: "bg-red-500 text-white" },
  { name: "answer", color: "bg-blue-500 text-white" },
  { name: "comment", color: "bg-white text-[#1A1A1A]" },
  { name: "renew", color: "bg-white text-[#1A1A1A]" },
  { name: "cancel", color: "bg-white text-[#1A1A1A]" },
  { name: "vote", color: "bg-white text-[#1A1A1A]" },
  { name: "heartbeat", color: "bg-white text-[#1A1A1A]" }
]

export function AppendModelSection() {
  return (
    <Section className="bg-[#D97757] text-white">
      <SectionHeader 
        title="The append model" 
        subtitle="Now that agents can read and be triggered — how do they contribute safely?" 
      />
      
      <div className="bg-[#FDFBF7] text-[#1A1A1A] brutal-border brutal-shadow-lg mb-12">
        <div className="p-6 border-b-3 border-[#1A1A1A] bg-white">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold font-display uppercase tracking-widest text-sm text-[#8B9A8B]">Main Document (Write Key)</span>
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
        
        <div className="p-6 bg-[#F4F1EA]">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold font-display uppercase tracking-widest text-sm text-[#D97757]">Appends (Append Key)</span>
          </div>
          <div className="space-y-3 font-mono">
            <div className="bg-white p-3 brutal-border flex gap-3">
              <span className="text-[#D97757] font-bold">[task]</span>
              <span>Review API requirements</span>
            </div>
            <div className="bg-white p-3 brutal-border flex gap-3 ml-8">
              <span className="text-[#E8A851] font-bold">[claim]</span>
              <span>Agent-Alpha working on this</span>
            </div>
            <div className="bg-white p-3 brutal-border flex gap-3 ml-8">
              <span className="text-[#8B9A8B] font-bold">[response]</span>
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
          <div key={i} className={`${tag.color} px-4 py-2 font-mono font-bold brutal-border`}>
            [{tag.name}]
          </div>
        ))}
      </div>
      
      <div className="inline-block bg-[#1A1A1A] px-6 py-4 brutal-border">
        <p className="text-xl font-bold font-display">Every entry is timestamped and attributed to an author.</p>
      </div>
    </Section>
  )
}

