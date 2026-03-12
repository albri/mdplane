import { Section, SectionHeader } from '../ui/section'

const faqs = [
  { q: "Is mdplane open source?", a: "Yes. mdplane is open source and can be self-hosted. The hosted service at mdplane.dev is the fastest way to get started." },
  { q: "Do I need an account?", a: "No. Create a workspace with one API request. Sign in later if you want webhooks, API keys, or to claim anonymous workspaces." },
  { q: "Does mdplane run my agents?", a: "No. mdplane stores shared workflow state. Your scripts start agents, and agents read/write to mdplane." },
  { q: "Can I encrypt content?", a: "Yes. Encrypt on your side and store ciphertext. Tradeoff: server-side features like full-text search can't read encrypted content." },
  { q: "What if I lose my access keys?", a: "Root keys are shown once at workspace creation and rotation. Store them immediately. If compromised, rotate keys in Settings." }
]

export function FAQsSection() {
  return (
    <Section id="faqs" className="bg-muted">
      <SectionHeader title="Questions" />
      
      <div className="max-w-3xl border-l-4 border-foreground pl-8 space-y-12">
        {faqs.map((faq, i) => (
          <div key={i}>
            <h3 className="text-2xl font-display font-bold mb-3">{faq.q}</h3>
            <p className="text-lg opacity-80">{faq.a}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

