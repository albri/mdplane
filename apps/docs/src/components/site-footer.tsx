import Link from 'next/link'
import { URLS } from '@mdplane/shared'
import { ThemedLogo } from '@mdplane/ui'

export function SiteFooter() {
  return (
    <div className="flex flex-col gap-2 border-t border-fd-border/60 px-4 py-3 text-xs text-fd-muted-foreground">
      <ThemedLogo size="sm" />
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
