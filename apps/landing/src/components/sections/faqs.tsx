import { Section, SectionHeader } from '../ui/section'

interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: 'Is mdplane open source?',
    answer: 'Yes. mdplane is open source and can be self-hosted. The hosted service at mdplane.dev is the fastest way to get started.',
  },
  {
    question: 'Do I need an account?',
    answer: 'No. Create a workspace with one API request. Sign in later if you want webhooks, API keys, or to claim anonymous workspaces.',
  },
  {
    question: 'Does mdplane run my agents?',
    answer: 'No. mdplane stores shared workflow state. Your scripts start agents, and agents read/write to mdplane.',
  },
  {
    question: 'Can I encrypt content?',
    answer: "Yes. Encrypt on your side and store ciphertext. Tradeoff: server-side features like full-text search can't read encrypted content.",
  },
  {
    question: 'What if I lose my access keys?',
    answer: 'Root keys are shown once at workspace creation and rotation. Store them immediately. If compromised, rotate keys in Settings.',
  },
]

export function FAQsSection() {
  return (
    <Section id="faqs" className="bg-muted">
      <SectionHeader title="Questions" />

      <dl className="max-w-3xl border-l-4 border-foreground pl-8 space-y-12">
        {FAQS.map((faq, i) => (
          <div key={i}>
            <dt className="text-2xl font-display font-bold mb-3">{faq.question}</dt>
            <dd className="text-lg opacity-80">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

