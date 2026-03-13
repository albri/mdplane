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
  CoordinationLayerSection,
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
      <AppendModelSection />
      <CoordinationLayerSection />
      <WorkspacesSection />
      <ThreeKeysSection />
      <ReadersSection />
      <AutomatingAgentsSection />
      <FullPictureSection />
      <WhyMarkdownSection />
      <FAQsSection />
      <FooterSection />
    </div>
  )
}

