import Link from 'next/link'
import { TAGLINE } from '@mdplane/shared'

import { NavLink, FooterLink } from '@/components/nav-link'
import { Logo } from '@mdplane/ui/brand/logo'
import { ThemeToggle } from '@mdplane/ui/ui/theme-toggle'
import { SITE } from './config'

export function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
          <Logo mdClassName="text-primary" />
        </Link>

        <nav className="flex items-center gap-1.5">
          <NavLink href={SITE.docsUrl}>Docs</NavLink>
          <NavLink href={SITE.apiUrl} className="hidden sm:inline-flex">API</NavLink>
          <NavLink href={SITE.appUrl} className="hidden sm:inline-flex">App</NavLink>
          <NavLink href={SITE.githubUrl} external>GitHub</NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border bg-background">
      <div className="absolute inset-0 bg-background" />
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <div>
              <Logo className="text-base" />
            </div>
            <div className="text-sm text-muted-foreground">
              {TAGLINE}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <div className="font-mono text-xs font-semibold tracking-wider text-foreground">PRODUCT</div>
              <FooterLink href={SITE.appUrl}>Open App</FooterLink>
              <FooterLink href={SITE.docsUrl}>Docs</FooterLink>
              <FooterLink href={SITE.apiUrl}>API</FooterLink>
              <FooterLink href={SITE.githubUrl}>GitHub</FooterLink>
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-mono text-xs font-semibold tracking-wider text-foreground">LEGAL</div>
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/terms">Terms</FooterLink>
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-mono text-xs font-semibold tracking-wider text-foreground">STATUS</div>
              <FooterLink href={SITE.statusUrl} external>Status</FooterLink>
              <FooterLink href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</FooterLink>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-dashed border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {SITE.name}</span>
          <span>
            Made by{' '}
            <a
              href="https://alexbristow.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary"
            >
              Alex Bristow
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
