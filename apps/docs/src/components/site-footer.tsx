import Link from 'next/link'
import { URLS } from '@mdplane/shared'

export function SiteFooter() {
  return (
    <div className="flex flex-col gap-2 border-t border-fd-border/60 px-4 py-3 text-xs text-fd-muted-foreground">
      <span className="font-mono font-medium text-fd-foreground">
        <span className="text-fd-primary">md</span>
        <span>plane</span>
      </span>
      <nav className="flex flex-wrap items-center gap-3">
        <Link href={URLS.APP} className="transition-colors hover:text-fd-foreground">
          App
        </Link>
        <Link href={URLS.API} className="transition-colors hover:text-fd-foreground">
          API
        </Link>
        <Link href={URLS.STATUS} className="transition-colors hover:text-fd-foreground">
          Status
        </Link>
      </nav>
    </div>
  )
}
