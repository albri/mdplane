'use client'

import { HERO_DESCRIPTION, TAGLINE, URLS } from '@mdplane/shared'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import dynamic from 'next/dynamic'
import { buttonVariants } from '@mdplane/ui/ui/button'

const HeroLogoScene = dynamic(
  () => import('@/components/hero-logo-scene').then((module) => module.HeroLogoScene),
  {
    ssr: false,
    loading: () => <div className="hero-logo-slot" aria-hidden />,
  }
)

export function HeroContent() {
  const docsCtaClass = buttonVariants({
    variant: 'outline',
  })
  const repoCtaClass = buttonVariants({
    variant: 'ghost',
  })

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(320px,420px)_1fr] lg:items-center">
      <div className="w-full lg:-ml-[3.75rem]">
        <HeroLogoScene />
      </div>

      <div className="text-left lg:-ml-[3.75rem]">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {TAGLINE}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {HERO_DESCRIPTION}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href={URLS.DOCS} className={docsCtaClass}>
            Read the docs
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <a
            href={URLS.GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className={repoCtaClass}
          >
            View repo
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  )
}
