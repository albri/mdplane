'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { FolderOpen, Sparkles } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'
import { formatSize, formatRelativeTime } from '@/lib/format'
import { FileIcon } from './file-icon'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@mdplane/ui/ui/button'
import { CommandTabs } from '@/components/control/command-tabs'

export interface FolderItem {
  name: string
  type: 'file' | 'folder'
  size?: number // bytes, for files
  childCount?: number // for folders (itemCount)
  updatedAt?: string
}

interface FolderViewProps {
  items: FolderItem[]
  path: string
  capabilityKey: string
  keyType: 'r' | 'w' | 'a'
  className?: string
  showClaimAction?: boolean
  onClaimWorkspace?: () => void
}

interface FolderItemRowProps {
  item: FolderItem
  href: string
}

function FolderItemRow({ item, href }: FolderItemRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        'hover:bg-muted/50 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
      )}
      data-testid="folder-item"
    >
      <div className="flex items-center gap-3">
        <FileIcon type={item.type} name={item.name} />
        <span className="break-all font-medium">{item.name}</span>
      </div>
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:w-auto sm:text-sm">
        <span>
          {item.type === 'folder'
            ? `${item.childCount ?? 0} ${item.childCount === 1 ? 'item' : 'items'}`
            : formatSize(item.size)}
        </span>
        {item.updatedAt && <span>Updated {formatRelativeTime(item.updatedAt)}</span>}
      </div>
    </Link>
  )
}

function FolderEmptyState() {
  return (
    <div data-testid="folder-empty">
      <EmptyState
        icon={<FolderOpen className="h-12 w-12" />}
        headline="This folder is empty"
      />
    </div>
  )
}

interface RootOnboardingStateProps {
  capabilityKey: string
  showClaimAction: boolean
  onClaimWorkspace?: () => void
}

function RootOnboardingState({
  capabilityKey,
  showClaimAction,
  onClaimWorkspace,
}: RootOnboardingStateProps) {
  const runtimeUrl = `https://app.mdplane.dev/r/${capabilityKey}`
  const orchestrationUrl = `${runtimeUrl}?view=orchestration`

  const writeReadmeApiCommand = [
    'curl -X PUT "https://api.mdplane.dev/w/YOUR_WRITE_KEY/README.md" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"content":"# Workspace Ready\\n\\nYour first file is live."}\'',
  ].join('\n')

  const writeReadmeCliCommand = [
    'mdplane write /README.md "# Workspace Ready\\n\\nYour first file is live."',
  ].join('\n')

  const appendTaskApiCommand = [
    'curl -X POST "https://api.mdplane.dev/a/YOUR_APPEND_KEY/tasks.md" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"author":"agent-1","type":"task","content":"Bootstrap runtime onboarding"}\'',
  ].join('\n')

  const appendTaskCliCommand = [
    'mdplane append /tasks.md "Bootstrap runtime onboarding" --type task --author agent-1',
  ].join('\n')

  const openOrchestrationBash = `xdg-open "${orchestrationUrl}" || open "${orchestrationUrl}"`

  return (
    <section
      data-testid="folder-empty-onboarding"
      className="space-y-5 rounded-lg border border-border/80 bg-card p-6 shadow-sm"
    >
      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Runtime quick start
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace is empty</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Create your first file with a write key, append a task with an append key, then open task orchestration in runtime.
        </p>
      </div>

      {showClaimAction && onClaimWorkspace ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
          <p className="text-sm font-medium">Unclaimed workspace</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Claim ownership to unlock governance in Control and key lifecycle management.
          </p>
          <Button onClick={onClaimWorkspace} className="mt-3" size="sm">
            Claim workspace
          </Button>
        </div>
      ) : null}

      <div className="space-y-4" data-testid="runtime-onboarding-command-tabs">
        <div className="space-y-2">
          <h2 className="text-sm font-medium">1. Create README.md with write key</h2>
          <CommandTabs
            apiCommand={writeReadmeApiCommand}
            cliCommand={writeReadmeCliCommand}
            copyMode="inline"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium">2. Append a task with append key</h2>
          <CommandTabs
            apiCommand={appendTaskApiCommand}
            cliCommand={appendTaskCliCommand}
            copyMode="inline"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium">3. Open runtime orchestration</h2>
          <CommandTabs
            command={openOrchestrationBash}
            copyMode="inline"
          />
        </div>
      </div>
    </section>
  )
}

export function FolderView({
  items,
  path,
  capabilityKey,
  keyType,
  className,
  showClaimAction = false,
  onClaimWorkspace,
}: FolderViewProps) {
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [items])

  if (items.length === 0) {
    if (path === '/' && keyType === 'r') {
      return (
        <RootOnboardingState
          capabilityKey={capabilityKey}
          showClaimAction={showClaimAction}
          onClaimWorkspace={onClaimWorkspace}
        />
      )
    }
    return <FolderEmptyState />
  }

  const basePath = `/${keyType}/${capabilityKey}${path === '/' ? '' : path}`

  return (
    <div className={cn('space-y-2', className)} data-testid="folder-view">
      <div className="surface-panel divide-y divide-border/70">
        {sortedItems.map((item) => (
          <FolderItemRow
            key={item.name}
            item={item}
            href={`${basePath}/${item.name}`}
          />
        ))}
      </div>

      <p className="mt-3 text-sm text-muted-foreground" data-testid="folder-count">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>
    </div>
  )
}


