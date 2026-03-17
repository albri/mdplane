import Link from 'next/link'
import { ThemedLogo } from '@mdplane/ui'
import { BookOpen } from 'lucide-react'
import { URLS } from '@mdplane/shared'

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background p-6" data-testid="not-found">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-muted/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-muted/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-md">
        <ThemedLogo size="lg" className="mx-auto mb-8" />

        <p className="font-display text-[8rem] leading-none font-bold text-foreground/10 select-none">
          404
        </p>

        <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">
          Page not found
        </h1>

        <p className="mt-3 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <div className="mt-8">
          <Link
            href={URLS.DOCS}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BookOpen className="h-4 w-4" />
            View documentation
          </Link>
        </div>
      </div>
    </div>
  )
}
