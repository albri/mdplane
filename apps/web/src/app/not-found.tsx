import Link from 'next/link'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <p className="font-display text-8xl font-bold text-terracotta">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been moved or deleted.</p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 border-2 border-foreground bg-terracotta px-6 py-3 font-display font-bold text-white shadow-[4px_4px_0_0_var(--foreground)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--foreground)]"
        >
          <Home className="h-4 w-4" />
          Go home
        </Link>
      </div>
    </div>
  )
}
