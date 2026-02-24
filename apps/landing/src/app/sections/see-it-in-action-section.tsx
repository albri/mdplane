import { SectionHeading } from '@/components/section-heading'
import { SeeItInActionClient } from './see-it-in-action-client'
import { INTRO_TEXT, STORY_STEPS } from './see-it-in-action-data'

type SeeItInActionSectionProps = {
  className?: string
}

export function SeeItInActionSection({ className }: SeeItInActionSectionProps) {
  return (
    <section className={className}>
      <div className="text-center">
        <SectionHeading>SEE IT IN ACTION</SectionHeading>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{INTRO_TEXT}</p>
      </div>

      <SeeItInActionClient steps={STORY_STEPS} />
    </section>
  )
}
