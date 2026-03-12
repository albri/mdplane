import { Section, SectionHeader } from '../ui/section'

const cards = [
  { title: "Agents read it reliably", desc: "The format they're most reliable at reading, writing, and reasoning over." },
  { title: "Humans read it too", desc: "Inspect and edit the exact same artifact that your agents use." },
  { title: "No schema needed", desc: "Structure emerges naturally from headings, lists, and appends." }
]

export function WhyMarkdownSection() {
  return (
    <Section className="bg-[#E8A851]">
      <SectionHeader 
        title="Why markdown?" 
        subtitle="The de facto interface language for agent and human collaboration." 
      />
      
      <div className="grid md:grid-cols-3 gap-8">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-8 brutal-border brutal-shadow-lg">
            <h3 className="text-2xl font-display font-bold mb-4">{card.title}</h3>
            <p className="text-lg font-medium opacity-80">{card.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

