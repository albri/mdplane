import { Key } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const keys = [
  { title: "READ", desc: "View files, copy content", key: "r_x7k9p2...", color: "bg-background", text: "text-foreground" },
  { title: "APPEND", desc: "Read + add content", key: "a_m4n8v1...", color: "bg-amber", text: "text-foreground" },
  { title: "WRITE", desc: "Full control", key: "w_q9z3b5...", color: "bg-terracotta", text: "text-white" }
]

export function ThreeKeysSection() {
  return (
    <Section className="bg-sage text-white">
      <SectionHeader 
        title="Three keys" 
        subtitle="Creating a workspace gives you three capability URLs. Share the right one for the right access level." 
      />
      
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {keys.map((card, i) => (
          <div key={i} className={`${card.color} ${card.text} p-8 border-3 border-border shadow-lg transform transition-transform hover:-translate-y-2`}>
            <h3 className="text-3xl font-display font-bold mb-2">{card.title}</h3>
            <p className="text-lg font-medium mb-8 opacity-80">{card.desc}</p>
            <div className="bg-card/50 p-3 border-3 border-border flex items-center gap-3">
              <Key size={20} />
              <code className="font-bold">{card.key}</code>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center">
        <p className="text-3xl font-display font-bold inline-block bg-foreground text-background px-8 py-4 border-3 border-border">
          No accounts needed. The URL is the credential.
        </p>
      </div>
    </Section>
  )
}

