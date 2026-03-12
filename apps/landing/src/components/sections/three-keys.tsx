import { Key } from 'lucide-react'
import { Section, SectionHeader } from '../ui/section'

interface KeyType {
  title: string
  description: string
  keyPrefix: string
  color: string
  textColor: string
}

const KEYS: KeyType[] = [
  { title: 'READ', description: 'View files, copy content', keyPrefix: 'r_x7k9p2...', color: 'bg-background', textColor: 'text-foreground' },
  { title: 'APPEND', description: 'Read + add content', keyPrefix: 'a_m4n8v1...', color: 'bg-amber', textColor: 'text-foreground' },
  { title: 'WRITE', description: 'Full control', keyPrefix: 'w_q9z3b5...', color: 'bg-terracotta', textColor: 'text-white' },
]

function KeyCard({ keyType }: { keyType: KeyType }) {
  return (
    <article
      className={`${keyType.color} ${keyType.textColor} p-8 border-3 border-border shadow-lg transform transition-transform hover:-translate-y-2 focus-within:ring-2 focus-within:ring-offset-2`}
    >
      <h3 className="text-3xl font-display font-bold mb-2">{keyType.title}</h3>
      <p className="text-lg font-medium mb-8 opacity-80">{keyType.description}</p>
      <div className="bg-card/50 p-3 border-3 border-border flex items-center gap-3">
        <Key size={20} aria-hidden="true" />
        <code className="font-bold">{keyType.keyPrefix}</code>
      </div>
    </article>
  )
}

export function ThreeKeysSection() {
  return (
    <Section className="bg-sage text-white">
      <SectionHeader
        title="Three keys"
        subtitle="Creating a workspace gives you three capability URLs. Share the right one for the right access level."
      />

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {KEYS.map((keyType) => (
          <KeyCard key={keyType.title} keyType={keyType} />
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

