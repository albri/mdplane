'use client'

import {
  SidebarCollapseTrigger,
  SidebarFooter,
  SidebarViewport,
  useSidebarContext,
} from '@/components/shell'
import { sidebarCollapseButtonClassName } from '@/components/shell/sidebar-styles'
import type { PageTreeRoot, WorkspaceContext } from '@/lib/capability/fetch-folder-tree'
import type { KeyType } from '@mdplane/shared'
import { Logo } from '@mdplane/ui/brand/logo'
import { cn } from '@mdplane/ui/lib/utils'
import { Button } from '@mdplane/ui/ui/button'
import { ThemeToggle } from '@mdplane/ui/ui/theme-toggle'
import { PanelLeft, SquareKanban } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { ClaimedIndicator } from './claimed-indicator'
import { SidebarFileTree } from './sidebar-file-tree'
import { WorkspaceClaimDialog } from './workspace-claim-dialog'

interface ReaderSidebarProps {
  pageTree: PageTreeRoot
  pathname: string
  keyType: KeyType
  capabilityKey: string
  workspace?: WorkspaceContext | null
  isOwner: boolean
  ownerWorkspaceId?: string
}

export function ReaderSidebar({
  pageTree,
  pathname,
  keyType,
  capabilityKey,
  workspace,
  isOwner,
  ownerWorkspaceId,
}: ReaderSidebarProps) {
  const { setOpen, mode } = useSidebarContext()
  const router = useRouter()
  const searchParams = useSearchParams()

  const showClaimAction = workspace?.claimed === false && !isOwner
  const runtimeRootPath = `/${keyType}/${capabilityKey}`
  const isRuntimeRoot = pathname === runtimeRootPath
  const isOrchestrationView = isRuntimeRoot && searchParams.get('view') === 'orchestration'

  const workspaceHeading = useMemo(() => {
    const namedWorkspace = workspace?.name?.trim()
    if (namedWorkspace) return namedWorkspace

    const workspaceId = workspace?.id?.trim()
    if (workspaceId) return workspaceId

    const treeName = pageTree.name?.trim()
    if (treeName) return treeName

    return 'Workspace'
  }, [pageTree.name, workspace?.id, workspace?.name])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex">
          <Link
            href={runtimeRootPath}
            className="me-auto inline-flex items-center gap-2 text-[0.9375rem] font-medium"
            onClick={() => setOpen(false)}
          >
            <Logo />
          </Link>
          {mode === 'full' ? (
            <SidebarCollapseTrigger className={`${sidebarCollapseButtonClassName} mb-auto`}>
              <PanelLeft />
            </SidebarCollapseTrigger>
          ) : null}
        </div>
      </div>

      <SidebarViewport contentClassName="pb-4 pt-2 pl-1 pr-4">
        <p
          data-slot="sidebar-section-title"
          data-testid="reader-workspace-heading"
          className="mb-1.5 inline-flex max-w-full items-center gap-2 truncate px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0"
          style={{ paddingInlineStart: 'calc(2 * var(--spacing))' }}
        >
          {workspaceHeading}
        </p>
        <SidebarFileTree
          pageTree={pageTree}
          pathname={pathname}
          keyType={keyType}
          capabilityKey={capabilityKey}
          onSelect={(path) => {
            setOpen(false)
            router.push(path)
          }}
        />
      </SidebarViewport>

      <SidebarFooter>
        <Button
          variant="ghost"
          data-testid="reader-orchestration-button"
          className={cn(
            'h-auto w-full justify-start gap-2 rounded-lg p-2 text-start text-muted-foreground transition-[color,box-shadow] hover:bg-accent/50 hover:text-accent-foreground/80 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            {
              'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary': isOrchestrationView,
            }
          )}
          onClick={() => {
            setOpen(false)
            router.push(`${runtimeRootPath}?view=orchestration`)
          }}
        >
          <SquareKanban className="h-4 w-4" />
          <span className="truncate">Orchestration</span>
        </Button>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {isOwner && ownerWorkspaceId ? (
              <ClaimedIndicator workspaceId={ownerWorkspaceId} />
            ) : showClaimAction ? (
              <WorkspaceClaimDialog onNavigate={() => setOpen(false)} />
            ) : null}
          </div>
          <ThemeToggle className="ms-auto p-0" />
        </div>
      </SidebarFooter>
    </div>
  )
}

