import { URLS } from '@mdplane/shared'
import { Button } from '@mdplane/ui/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export function ControlModeNotConfiguredState() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-4 sm:p-8" data-testid="control-mode-not-configured-state">
      <Card className="w-full border-border/80 shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl tracking-tight">Control mode not configured</CardTitle>
          <CardDescription className="max-w-3xl text-sm sm:text-base">
            This deployment is currently running in capability-first mode. Control plane routes require governed mode with OAuth providers configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button asChild className="justify-start gap-2">
            <a href={`${URLS.DOCS}/docs/access-and-auth`} target="_blank" rel="noopener noreferrer">
              <Settings className="h-4 w-4" />
              Configure OAuth
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Self-host operators can set `NEXT_PUBLIC_GOVERNED_MODE=true` and configure provider credentials on the API server to enable control plane access.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
