import { faqs } from '../content'
import { SectionHeading } from '@/components/section-heading'

type QuestionsSectionProps = {
  className?: string
}

export function QuestionsSection({ className }: QuestionsSectionProps) {
  return (
    <section className={className}>
      <SectionHeading>QUESTIONS</SectionHeading>

      <div className="mt-8 space-y-6">
        {faqs.map((faq) => (
          <div key={faq.q} className="border-l-2 border-primary pl-4">
            <h3 className="font-medium text-foreground">{faq.q}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
