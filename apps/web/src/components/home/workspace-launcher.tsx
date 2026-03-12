'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AUTH_FRONTEND_ROUTES } from '@mdplane/shared'
import { buildCapabilityPath, parseCapabilityUrl } from './capability-url'
import {
  MAX_RECENT_WORKSPACE_URLS,
  RECENT_WORKSPACE_STORAGE_KEY,
  serializeRecentWorkspaceState,
  deserializeRecentWorkspaceState,
  type RecentWorkspaceUrl,
} from './recent-workspace-storage'
import { Link as LinkIcon, History, Plus, ArrowRight, Trash2 } from 'lucide-react'

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
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold">Workspace Launcher</h1>
          <p className="mt-2 text-muted-foreground">
            Open an existing workspace or create a new one
          </p>
        </div>

        <div className="border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_var(--foreground)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-terracotta">
              <LinkIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold">Open Existing Workspace</h2>
              <p className="text-sm text-muted-foreground">Paste a capability URL or key</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Capability URL or key"
              value={capabilityInput}
              onChange={(e) => {
                setCapabilityInput(e.target.value)
                setInputError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenWorkspace()}
              className="w-full border-2 border-foreground bg-background px-4 py-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terracotta"
            />
            {inputError && <p className="text-sm text-destructive">{inputError}</p>}
            <button
              onClick={handleOpenWorkspace}
              disabled={!capabilityInput.trim()}
              className="flex w-full items-center justify-center gap-2 border-2 border-foreground bg-terracotta px-4 py-3 font-display font-bold text-white transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[3px_3px_0_0_var(--foreground)] disabled:opacity-50"
            >
              Open Workspace
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_var(--foreground)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center bg-sage">
                <History className="h-5 w-5 text-white" />
              </div>
              <h2 className="font-display font-bold">Recent Workspaces</h2>
            </div>
            <button
              onClick={() => handleSaveRecentChange(!saveRecent)}
              className={`border-2 border-foreground px-3 py-1 text-xs font-bold transition-colors ${
                saveRecent ? 'bg-sage text-white' : 'bg-background text-foreground'
              }`}
            >
              {saveRecent ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          {recentUrls.length > 0 ? (
            <div className="space-y-2">
              {recentUrls.map((recent) => (
                <div
                  key={recent.url}
                  className="flex items-center justify-between border-2 border-border bg-background p-2"
                >
                  <Link href={recent.url} className="flex-1 font-mono text-sm hover:text-terracotta">
                    {recent.label}
                  </Link>
                  <button
                    onClick={() => removeRecentUrl(recent.url)}
                    aria-label={`Remove recent workspace ${recent.label}`}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={clearAllRecent}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {saveRecent ? 'No recent URLs yet' : 'Enable to save recent URLs'}
            </p>
          )}
        </div>

        <div className="border-2 border-dashed border-foreground bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-amber">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold">Create New Workspace</h2>
              <p className="text-sm text-muted-foreground">Start fresh with new root keys</p>
            </div>
          </div>
          <Link
            href={AUTH_FRONTEND_ROUTES.bootstrap}
            className="flex w-full items-center justify-center gap-2 border-2 border-foreground bg-amber px-4 py-3 font-display font-bold text-foreground transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-[3px_3px_0_0_var(--foreground)]"
          >
            Create Workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
