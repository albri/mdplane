import { Users, Terminal, Check } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const bullets = [
  "Same key, different endpoints",
  "Persistent context — survives sessions",
  "Update the file, everyone gets the latest"
]

export function ReadersSection() {
  return (
    <Section className="bg-background">
      <SectionHeader 
        title="Anyone with the key can read" 
        subtitle="Humans and agents each get what they need." 
      />
      
      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="bg-white p-8 border-3 border-border shadow">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-amber border-3 border-border flex items-center justify-center">
              <Users size={24} />
            </div>
            <h3 className="text-2xl font-display font-bold">Humans</h3>
          </div>
          <div className="bg-muted p-4 border-3 border-border mb-6 font-mono text-sm break-all">
            app.mdplane.dev/r/x7k9p2
          </div>
          <div className="border-l-4 border-foreground pl-6 py-2">
            <h4 className="font-display font-bold text-xl mb-2">Beautifully formatted</h4>
            <p className="opacity-80">Rich typography, syntax highlighting, and a clean reading experience.</p>
          </div>
        </div>
        
        <div className="bg-foreground text-white p-8 border-3 border-border shadow">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-sage border-3 border-border flex items-center justify-center text-foreground">
              <Terminal size={24} />
            </div>
            <h3 className="text-2xl font-display font-bold">Agents</h3>
          </div>
          <div className="bg-white/10 p-4 border-3 border-border mb-6 font-mono text-sm break-all text-amber">
            api.mdplane.dev/r/x7k9p2/raw
          </div>
          <div className="border-l-4 border-sage pl-6 py-2">
            <h4 className="font-display font-bold text-xl mb-2">Raw markdown or JSON</h4>
            <p className="opacity-80">Clean text ready for context windows, or structured JSON for parsing.</p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 justify-center">
        {bullets.map((bullet, i) => (
          <div key={i} className="flex items-center gap-3 bg-white px-6 py-3 border-3 border-border shadow-sm">
            <Check size={20} className="text-terracotta" />
            <span className="font-bold">{bullet}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

