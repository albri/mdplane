import Link from 'next/link'
import { Logo } from '@mdplane/ui'

const NAV_LINKS = [
  { href: '#problem', label: 'Problem' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#events', label: 'Events' },
  { href: '#faqs', label: 'FAQs' },
  { href: 'https://docs.mdplane.dev', label: 'Docs' },
]

export function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-background border-b-3 border-foreground px-6 py-4 flex justify-between items-center"
      role="navigation"
      aria-label="Main navigation"
    >
      <Link href="/" className="flex items-center focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
        <Logo size="lg" />
        <span className="sr-only">mdplane home</span>
      </Link>
      <ul className="hidden md:flex gap-8 font-medium" role="list">
        {NAV_LINKS.map(({ href, label }) => (
          <li key={href}>
            <a
              href={href}
              className="hover:underline underline-offset-4 decoration-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-1 py-1"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
