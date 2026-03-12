import { Section, SectionHeader } from '../ui/section'

interface Card {
  title: string
  description: string
}

const CARDS: Card[] = [
  { title: 'Agents read it reliably', description: "The format they're most reliable at reading, writing, and reasoning over." },
  { title: 'Humans read it too', description: 'Inspect and edit the exact same artifact that your agents use.' },
  { title: 'No schema needed', description: 'Structure emerges naturally from headings, lists, and appends.' },
]

export function WhyMarkdownSection() {
  return (
    <Section className="bg-amber">
      <SectionHeader title="Why markdown?" subtitle="The de facto interface language for agent and human collaboration." />

      <ul className="grid md:grid-cols-3 gap-8" role="list">
        {CARDS.map((card) => (
          <li key={card.title} className="bg-card p-8 border-3 border-border shadow-lg">
            <h3 className="text-2xl font-display font-bold mb-4">{card.title}</h3>
            <p className="text-lg font-medium opacity-80">{card.description}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

