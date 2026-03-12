import { Zap, FileText, Shield, Terminal } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

const painPoints = [
  { icon: Zap, text: "Share it instantly, no account required" },
  { icon: FileText, text: "See it formatted nicely, no friction" },
  { icon: Shield, text: "Share it securely, with access control" },
  { icon: Terminal, text: "Let agents read it — or even coordinate around it" }
]

export function WhyMdplaneSection() {
  return (
    <Section id="why" className="bg-[#F4F1EA]">
      <SectionHeader 
        title="Why mdplane?" 
        subtitle="You have markdown you want to share — a spec, a runbook, some notes." 
      />
      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-6">
          {painPoints.map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-6 bg-white brutal-border brutal-shadow-sm">
              <div className="bg-[#E8A851] p-2 brutal-border">
                <item.icon size={24} />
              </div>
              <p className="text-xl font-medium pt-1">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center p-8 bg-[#8B9A8B] brutal-border brutal-shadow">
          <p className="text-3xl font-display font-bold text-white leading-tight">
            mdplane gives your markdown a workspace — secure, shareable, readable by humans and agents alike.
          </p>
        </div>
      </div>
    </Section>
  )
}

