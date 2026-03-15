'use client'

import {
  Navbar,
  HeroSection,
  WhyMdplaneSection,
  WorkspacesSection,
  FilesSection,
  ReadersSection,
  AutomatingAgentsSection,
  AppendModelSection,
  CoordinationLayerSection,
  FullPictureSection,
  WhyMarkdownSection,
  FAQsSection,
  FooterSection,
} from '@/components/sections'

export default function Home() {
  return (
    <div className="min-h-screen selection:bg-amber selection:text-foreground">
      <Navbar />
      <HeroSection />
      <WhyMdplaneSection />
      <CoordinationLayerSection />
      <WorkspacesSection />
      <FilesSection />
      <AppendModelSection />
      <AutomatingAgentsSection />
      <ReadersSection />
      <FullPictureSection />
      <WhyMarkdownSection />
      <FAQsSection />
      <FooterSection />
    </div>
  )
}
