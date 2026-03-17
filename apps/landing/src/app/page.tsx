'use client'

import {
  Navbar,
  HeroSection,
  WhyMdplaneSection,
  WorkspacesSection,
  FilesSection,
  ViewsSection,
  EventsSection,
  AppendsSection,
  BuildingBlocksSection,
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
      <BuildingBlocksSection />
      <WorkspacesSection />
      <FilesSection />
      <AppendsSection />
      <EventsSection />
      <ViewsSection />
      <FullPictureSection />
      <WhyMarkdownSection />
      <FAQsSection />
      <FooterSection />
    </div>
  )
}
