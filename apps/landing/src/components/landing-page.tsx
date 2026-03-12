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
    <div className="min-h-screen selection:bg-[#E8A851] selection:text-[#1A1A1A]">
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

