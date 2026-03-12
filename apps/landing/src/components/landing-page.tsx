'use client'

import {
  Navbar,
  HeroSection,
  WhyMdplaneSection,
  WorkspacesSection,
  ThreeKeysSection,
  ReadersSection,
  AutomatingAgentsSection,
  AppendModelSection,
  FullPictureSection,
  WhyMarkdownSection,
  FAQsSection,
  FooterSection,
} from './sections'

export function LandingPage() {
  return (
    <div className="min-h-screen selection:bg-amber selection:text-foreground">
      <Navbar />
      <HeroSection />
      <WhyMdplaneSection />
      <WorkspacesSection />
      <ThreeKeysSection />
      <ReadersSection />
      <AutomatingAgentsSection />
      <AppendModelSection />
      <FullPictureSection />
      <WhyMarkdownSection />
      <FAQsSection />
      <FooterSection />
    </div>
  )
}

