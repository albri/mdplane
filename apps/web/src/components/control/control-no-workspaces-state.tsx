'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AUTH_FRONTEND_ROUTES, URLS, WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@mdplane/ui/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BorderedIcon } from '@mdplane/ui/ui/bordered-icon'
import { ArrowRight, FileKey, FolderPlus } from 'lucide-react'
import { extractWriteKey } from '@/lib/extract-write-key'

export function ControlNoWorkspacesState() {
  const router = useRouter()
  const [writeKeyInput, setWriteKeyInput] = useState('')
  const resolvedWriteKey = useMemo(() => extractWriteKey(writeKeyInput), [writeKeyInput])

  function handleClaimSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolvedWriteKey) return
    router.push(AUTH_FRONTEND_ROUTES.claimWorkspace(resolvedWriteKey))
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-4 sm:p-8" data-testid="control-no-workspaces-state">
      <Card className="w-full border-border/80 shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl tracking-tight">Claim a workspace to continue</CardTitle>
          <CardDescription className="max-w-3xl text-sm sm:text-base">
            Control becomes available after you claim a workspace. Claim links bind ownership so you can manage keys, webhooks, and workspace settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card tone="muted" size="sm">
              <CardHeader className="space-y-1.5">
                <BorderedIcon variant="primary" className="mb-1 h-9 w-9">
                  <FolderPlus className="h-4 w-4" />
                </BorderedIcon>
                <CardTitle className="text-base">Create a workspace</CardTitle>
                <CardDescription>
                  Bootstrap a new workspace, then store read/append/write keys immediately.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link href={WORKSPACE_FRONTEND_ROUTES.launch}>
                    Open Workspace Launcher
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card tone="muted" size="sm">
              <CardHeader className="space-y-1.5">
                <BorderedIcon variant="secondary" className="mb-1 h-9 w-9">
                  <FileKey className="h-4 w-4" />
                </BorderedIcon>
                <CardTitle className="text-base">Claim with write key</CardTitle>
                <CardDescription>
                  Paste a write key or claim URL to continue through OAuth claim.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleClaimSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="control-claim-write-key">Write key</Label>
                    <Input
                      id="control-claim-write-key"
                      value={writeKeyInput}
                      onChange={(event) => setWriteKeyInput(event.target.value)}
                      placeholder="Paste write key or /claim URL"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={!resolvedWriteKey}>
                    Continue to claim
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Need help?{' '}
            <a
              href={`${URLS.DOCS}/docs/what-is-mdplane`}
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              What is mdplane
            </a>
            {' '}|{' '}
            <a
              href={`${URLS.DOCS}/docs/authentication`}
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Authentication guide
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}


