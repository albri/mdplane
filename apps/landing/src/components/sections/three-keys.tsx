import { Key } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const keys = [
  { title: "READ", desc: "View files, copy content", key: "r_x7k9p2...", color: "bg-[#FDFBF7]", text: "text-[#1A1A1A]" },
  { title: "APPEND", desc: "Read + add content", key: "a_m4n8v1...", color: "bg-[#E8A851]", text: "text-[#1A1A1A]" },
  { title: "WRITE", desc: "Full control", key: "w_q9z3b5...", color: "bg-[#D97757]", text: "text-white" }
]

export function ThreeKeysSection() {
  return (
    <Section className="bg-[#8B9A8B] text-white">
      <SectionHeader 
        title="Three keys" 
        subtitle="Creating a workspace gives you three capability URLs. Share the right one for the right access level." 
      />
      
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {keys.map((card, i) => (
          <div key={i} className={`${card.color} ${card.text} p-8 brutal-border brutal-shadow-lg transform transition-transform hover:-translate-y-2`}>
            <h3 className="text-3xl font-display font-bold mb-2">{card.title}</h3>
            <p className="text-lg font-medium mb-8 opacity-80">{card.desc}</p>
            <div className="bg-white/50 p-3 brutal-border flex items-center gap-3">
              <Key size={20} />
              <code className="font-bold">{card.key}</code>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center">
        <p className="text-3xl font-display font-bold inline-block bg-[#1A1A1A] text-white px-8 py-4 brutal-border">
          No accounts needed. The URL is the credential.
        </p>
      </div>
    </Section>
  )
}

