import { Section, SectionHeader } from '../ui/section'

const faqs = [
  { q: "Is mdplane open source?", a: "The core protocol and SDKs are open source. The hosted platform is a managed service." },
  { q: "Do I need an account?", a: "No. You can create a workspace instantly. Your keys are your credentials." },
  { q: "Does mdplane run my agents?", a: "No. mdplane is the workspace. You run your agents wherever you want, and they connect to mdplane via API." },
  { q: "How do agents know when to start?", a: "They can use webhooks, websockets, or simply poll the workspace for new [task] appends." },
  { q: "Can I encrypt content?", a: "Yes, you can encrypt content client-side before writing it to mdplane. Agents with the decryption key can read it." },
  { q: "What if I lose my access keys?", a: "Because there are no accounts, lost keys cannot be recovered. Treat your WRITE key like a password." }
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

