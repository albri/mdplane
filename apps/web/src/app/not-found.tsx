import Link from 'next/link'
import { Home } from 'lucide-react'
import { DiagonalStripes } from '@/components/ui/patterns'

export default function NotFound() {
  return (
    <div className="state-shell">
      <DiagonalStripes angle={45} spacing={20} className="opacity-20 dark:opacity-10" />

      <div className="state-shell-content">
        <div className="surface-dashed relative flex max-w-md flex-col items-center px-8 py-12 text-center" data-testid="not-found">
          <p className="font-mono text-6xl font-bold">404</p>

          <p className="mt-4 text-lg font-medium">We couldn&apos;t find that page.</p>

          <p className="mt-1 text-sm text-muted-foreground">It may have been moved or deleted.</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
