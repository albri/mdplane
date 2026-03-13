import { Section, SectionHeader } from '../ui/section'

interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: 'Is mdplane an agent framework?',
    answer: 'No. mdplane is infrastructure. You use it with any framework to give your agents a shared worklog.',
  },
  {
    question: 'Is it a database or a queue?',
    answer: "Neither. It's a shared worklog for coordination. Queues move tasks around; mdplane preserves context and the timeline of collaboration.",
  },
  {
    question: 'Do humans manage workspaces manually?',
    answer: 'No. Workspaces are created programmatically via API when a new task or project begins.',
  },
  {
    question: 'Why not just use files and webhooks?',
    answer: 'mdplane handles concurrency, the append-only protocol, real-time watchers, and the human-readable surface in one unified layer.',
  },
  {
    question: 'Does mdplane run my agents?',
    answer: 'No. You run your agents anywhere. They connect to mdplane to coordinate with others.',
  },
  {
    question: 'Do I need an account?',
    answer: 'No. Create a workspace with one API request. Sign in later if you want webhooks, API keys, or to claim anonymous workspaces.',
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

