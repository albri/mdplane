import Link from 'next/link'
import { Logo } from '@mdplane/ui'

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b-3 border-foreground px-6 py-4 flex justify-between items-center">
      <Link href="/" className="flex items-center">
        <Logo size="lg" />
      </Link>
      <div className="hidden md:flex gap-8 font-medium">
        <a href="#why" className="hover:underline underline-offset-4 decoration-2">Why</a>
        <a href="#workspaces" className="hover:underline underline-offset-4 decoration-2">Workspaces</a>
        <a href="#agents" className="hover:underline underline-offset-4 decoration-2">Agents</a>
        <a href="#faqs" className="hover:underline underline-offset-4 decoration-2">FAQs</a>
      </div>
      <Link href="https://app.mdplane.dev" className="px-4 py-2 font-display font-bold text-base border-3 border-border shadow shadow-hover bg-background text-foreground">
        Open app
      </Link>
    </nav>
  )
}

