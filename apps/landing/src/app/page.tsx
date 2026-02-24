import { HeroContent } from '@/components/hero-content'
import { SectionDivider } from '@/components/section-divider'
import { SiteFooter, SiteHeader } from './site-chrome'
import { ProblemSection } from './sections/problem-section'
import { HowItWorksSection } from './sections/how-it-works-section'
import { WhyMarkdownSection } from './sections/why-markdown-section'
import { ComparisonSection } from './sections/comparison-section'
import { SeeItInActionSection } from './sections/see-it-in-action-section'
import { AdvancedFeaturesSection } from './sections/advanced-features-section'
import { QuestionsSection } from './sections/questions-section'
import { GetStartedSection } from './sections/get-started-section'

const HOME_SECTIONS = [
  { key: 'problem', Component: ProblemSection },
  { key: 'how-it-works', Component: HowItWorksSection },
  { key: 'why-markdown', Component: WhyMarkdownSection },
  { key: 'see-it-in-action', Component: SeeItInActionSection },
  { key: 'comparison', Component: ComparisonSection },
  { key: 'operational-capabilities', Component: AdvancedFeaturesSection },
  { key: 'questions', Component: QuestionsSection },
] as const

export default function Home() {
  const sectionClassName = 'mt-12 sm:mt-20'

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans">
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-0 right-0 z-0">
        <div
          className="hidden lg:block absolute inset-y-0 w-5 bg-stripes-left"
          style={{ left: 'max(0px, calc((100vw - 1152px) / 2 - 20px))' }}
        />
        <div
          className="hidden lg:block absolute inset-y-0 w-5 bg-stripes-right"
          style={{ right: 'max(0px, calc((100vw - 1152px) / 2 - 20px))' }}
        />
      </div>

      <SiteHeader />

      <div className="relative z-10 mx-auto max-w-6xl border-x border-border bg-background-content">
        <main className="mx-auto max-w-4xl px-4 pt-20 pb-14 sm:px-6 sm:pt-24 sm:pb-16">
          <section>
            <HeroContent />
          </section>

          <SectionDivider className="mt-8 sm:mt-16" />
          {HOME_SECTIONS.map(({ key, Component }) => (
            <div key={key}>
              <Component className={sectionClassName} />
              <SectionDivider />
            </div>
          ))}
          <GetStartedSection />
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}
