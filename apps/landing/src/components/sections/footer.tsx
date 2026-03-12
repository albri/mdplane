import Link from 'next/link'
import { Logo } from '@mdplane/ui'

export function FooterSection() {
  return (
    <footer className="bg-foreground text-background pt-24 pb-12 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-24 text-center">
          <h2 className="text-5xl md:text-7xl font-display font-bold mb-6">Get started</h2>
          <p className="text-2xl font-medium mb-10 opacity-80">Create a workspace. Share it with anyone (or anything).</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="https://app.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg border-3 border-border shadow shadow-hover inline-flex items-center justify-center gap-2 bg-terracotta text-white">
              Open app
            </Link>
            <Link href="https://docs.mdplane.dev" className="px-6 py-3 font-display font-bold text-lg border-3 border-border shadow shadow-hover inline-flex items-center justify-center gap-2 bg-card text-foreground">
              Read the docs
            </Link>
          </div>
        </div>

        <div className="border-t-2 border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Logo size="lg" variant="inverted" />
            <span className="opacity-50 font-sans font-normal text-base">— Shareable markdown workspaces.</span>
          </div>
          
          <div className="flex gap-6 font-medium opacity-80">
            <Link href="https://docs.mdplane.dev" className="hover:text-amber transition-colors">Docs</Link>
            <Link href="https://api.mdplane.dev" className="hover:text-amber transition-colors">API</Link>
            <Link href="https://github.com/alscotty/mdplane" className="hover:text-amber transition-colors">GitHub</Link>
            <Link href="/privacy" className="hover:text-amber transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-amber transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

