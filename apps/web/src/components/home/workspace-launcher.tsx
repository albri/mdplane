'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@mdplane/ui/ui/button'
import { Input } from '@/components/ui/input'
import { AUTH_FRONTEND_ROUTES } from '@mdplane/shared'
import { buildCapabilityPath, parseCapabilityUrl } from './capability-url'
import {
  MAX_RECENT_WORKSPACE_URLS,
  RECENT_WORKSPACE_STORAGE_KEY,
  serializeRecentWorkspaceState,
  deserializeRecentWorkspaceState,
  type RecentWorkspaceUrl,
} from './recent-workspace-storage'
import {
  Link as LinkIcon,
  History,
  Plus,
  ArrowRight,
  Trash2,
} from 'lucide-react'

export function WorkspaceLauncher() {
  const router = useRouter()
  const [capabilityInput, setCapabilityInput] = useState('')
  const [recentUrls, setRecentUrls] = useState<RecentWorkspaceUrl[]>([])
  const [saveRecent, setSaveRecent] = useState(false)
  const [inputError, setInputError] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_WORKSPACE_STORAGE_KEY)
      const parsed = deserializeRecentWorkspaceState(stored)
      setRecentUrls(parsed.urls)
      setSaveRecent(parsed.saveEnabled)
    } catch {
      // Ignore parse errors
    }
  }, [])

  const saveToStorage = useCallback((urls: RecentWorkspaceUrl[], enabled: boolean) => {
    try {
      localStorage.setItem(
        RECENT_WORKSPACE_STORAGE_KEY,
        serializeRecentWorkspaceState({ urls, saveEnabled: enabled }),
      )
    } catch {
      // Ignore storage errors
    }
  }, [])

  const addRecentUrl = useCallback((url: string, label: string) => {
    if (!saveRecent) return
    setRecentUrls((previous) => {
      const newEntry: RecentWorkspaceUrl = { url, label, addedAt: new Date().toISOString() }
      const filtered = previous.filter((r) => r.url !== url)
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_WORKSPACE_URLS)
      saveToStorage(updated, saveRecent)
      return updated
    })
  }, [saveRecent, saveToStorage])

  const removeRecentUrl = useCallback((url: string) => {
    const updated = recentUrls.filter((r) => r.url !== url)
    setRecentUrls(updated)
    saveToStorage(updated, saveRecent)
  }, [recentUrls, saveRecent, saveToStorage])

  const clearAllRecent = useCallback(() => {
    setRecentUrls([])
    saveToStorage([], saveRecent)
  }, [saveRecent, saveToStorage])

  const handleSaveRecentChange = useCallback((checked: boolean) => {
    setSaveRecent(checked)
    if (!checked) {
      setRecentUrls([])
      saveToStorage([], false)
    } else {
      saveToStorage(recentUrls, true)
    }
  }, [recentUrls, saveToStorage])

  const handleOpenWorkspace = useCallback(() => {
    setInputError('')
    const parsed = parseCapabilityUrl(capabilityInput)
    if (!parsed.ok) {
      setInputError(parsed.error)
      return
    }
    const path = buildCapabilityPath(parsed.value.key, parsed.value.suffix)
    addRecentUrl(path, `R key: ${parsed.value.key.slice(0, 8)}...`)
    router.push(path)
  }, [capabilityInput, router, addRecentUrl])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace Launcher</h1>
          <p className="mt-1 text-muted-foreground">
            Open an existing workspace or create a new one
          </p>
        </div>

        <Card tone="muted" size="sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Open Existing Workspace</CardTitle>
            </div>
            <CardDescription>
              Paste a read URL (`/r/...`) or a read key. Bare keys open read runtime by default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Capability URL or key"
              value={capabilityInput}
              onChange={(e) => {
                setCapabilityInput(e.target.value)
                setInputError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenWorkspace()}
            />
            {inputError && <p className="text-sm text-destructive">{inputError}</p>}
            <Button onClick={handleOpenWorkspace} disabled={!capabilityInput.trim()} className="w-full">
              Open Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card tone="muted" size="sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Recent Workspaces</CardTitle>
              </div>
              <Button
                variant={saveRecent ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSaveRecentChange(!saveRecent)}
                className="h-7 text-xs"
              >
                {saveRecent ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
            <CardDescription>
              {saveRecent
                ? 'Recent runtime URLs are stored in your browser'
                : 'Enable to save recent runtime URLs (browser only)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentUrls.length > 0 ? (
              <div className="space-y-2">
                {recentUrls.map((recent) => (
                  <div
                    key={recent.url}
                    className="flex items-center justify-between rounded-md border border-border/80 bg-background p-2 text-sm"
                  >
                    <Link
                      href={recent.url}
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'sm',
                        className: 'h-8 flex-1 justify-start rounded-md px-2 font-mono text-xs',
                      })}
                    >
                      {recent.label}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecentUrl(recent.url)}
                      aria-label={`Remove recent workspace ${recent.label}`}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllRecent}
                  className="w-full text-xs text-muted-foreground"
                >
                  Clear all
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {saveRecent ? 'No recent URLs yet' : 'Enable to save recent URLs (browser only)'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card tone="muted" size="sm" className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Create New Workspace</CardTitle>
            </div>
            <CardDescription>
              Start fresh with a new workspace and receive root keys once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link href={AUTH_FRONTEND_ROUTES.bootstrap}>
                Create Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
