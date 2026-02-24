'use client'

import { URLS } from '@mdplane/shared'
import { Button } from '@mdplane/ui/ui/button'
import { DiagonalStripes, IntersectionMarks } from '@/components/ui/patterns'
import { RefreshCw, Activity } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="state-shell" data-testid="error-page">
          <DiagonalStripes angle={135} spacing={24} className="opacity-25" />
          <IntersectionMarks size={52} className="opacity-15" />

          <div className="state-shell-content">
            <div className="state-shell-card max-w-xl rounded-xl p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
                <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>

              <h1 className="text-2xl font-semibold">Something went wrong</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                We hit an unexpected error. Try again.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => reset()} data-testid="error-try-again-btn">
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
              </div>

              <a
                href={URLS.STATUS}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Check system status
              </a>

              {error.digest ? (
                <p className="mt-6 text-xs font-mono text-muted-foreground">
                  Error ID: {error.digest}
                </p>
              ) : null}
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
