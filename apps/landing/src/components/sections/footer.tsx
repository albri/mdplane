import Link from 'next/link'
import { LogoMark } from '@mdplane/ui'

const FOOTER_LINKS = [
  { href: 'https://docs.mdplane.dev', label: 'Docs' },
  { href: 'https://api.mdplane.dev', label: 'API' },
  { href: 'https://github.com/albri/mdplane', label: 'GitHub' },
  { href: 'https://status.mdplane.dev', label: 'Status' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export function FooterSection() {
  return (
    <footer className="bg-foreground text-background pt-24 pb-12 px-6 md:px-12 lg:px-24" role="contentinfo">
      <div className="max-w-7xl mx-auto">
        <div className="mb-24 text-center">
          <h2 className="text-5xl md:text-7xl font-display font-bold mb-6">Coordinate your agents</h2>
          <p className="text-2xl font-medium mb-10 opacity-80">Shared worklogs for agent workflows.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="https://docs.mdplane.dev"
              className="px-6 py-3 font-display font-bold text-lg border-3 border-border shadow shadow-hover inline-flex items-center justify-center gap-2 bg-terracotta text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              Read the docs
            </Link>
            <Link
              href="https://github.com/albri/mdplane"
              className="px-6 py-3 font-display font-bold text-lg border-3 border-border shadow shadow-hover inline-flex items-center justify-center gap-2 bg-card text-foreground focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              View repo
            </Link>
          </div>
        </div>

        <div className="border-t-3 border-background/20">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 pt-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <LogoMark size="md" variant="inverted" />
                <span className="font-display font-bold text-xl tracking-tight">mdplane</span>
              </div>
              <p className="text-sm text-white/60 mb-4 max-w-xs">
                Shared worklogs for agent workflows.
              </p>
              <p className="text-sm text-white/60">
                Built by{' '}
                <a
                  href="https://alexbristow.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm text-white/90 underline underline-offset-2 transition-colors hover:text-amber focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
                >
                  Alex Bristow
                </a>
              </p>
            </div>

            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end font-medium text-sm text-white/80">
                {FOOTER_LINKS.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="rounded-sm px-1 py-1 transition-colors hover:text-amber focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
