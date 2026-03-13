import Link from 'next/link'
import { Logo } from '@mdplane/ui'

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

        <div className="border-t-2 border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Logo size="lg" variant="inverted" />
            <span className="opacity-50 font-sans font-normal text-base">— Shared worklogs for agent workflows.</span>
          </div>

          <nav aria-label="Footer">
            <ul className="flex gap-6 font-medium opacity-80">
              {FOOTER_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="hover:text-amber transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-foreground rounded-sm py-1"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}

