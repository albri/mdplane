'use client'

import {
  SidebarCollapseTrigger,
  SidebarContent,
  SidebarDrawer,
  SidebarFooter,
  SidebarTrigger,
  SidebarViewport,
  WorkspaceShell,
  useSidebarContext,
} from '@/components/shell'
import { sidebarCollapseButtonClassName } from '@/components/shell/sidebar-styles'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileTree, FileTreeFile, FileTreeFolder } from '@/components/ui/file-tree'
import { Input } from '@/components/ui/input'
import { useIsOwner } from '@/hooks/use-is-owner'
import type { PageTreeNode, PageTreeRoot, WorkspaceContext } from '@/lib/capability/fetch-folder-tree'
import { extractWriteKey } from '@/lib/extract-write-key'
import { type KeyType } from '@mdplane/shared'
import { Logo } from '@mdplane/ui/brand/logo'
import { cn } from '@mdplane/ui/lib/utils'
import { Button } from '@mdplane/ui/ui/button'
import { ThemeToggle } from '@mdplane/ui/ui/theme-toggle'
import { File, FileText, KeyRound, PanelLeft, SquareKanban } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { FormEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { OwnerBanner } from './owner-banner'

interface ReaderDocsLayoutProps {
  pageTree: PageTreeRoot
  keyType: KeyType
  capabilityKey: string
  workspace?: WorkspaceContext | null
  children: ReactNode
}

function getFileIcon(name: string) {
  if (name.endsWith('.md') || !name.includes('.')) {
    return <FileText className="size-4" />
  }
  return <File className="size-4" />
}

function hasFileNodeAtPath(tree: PageTreeRoot, selectedPath: string) {
  const stack: PageTreeNode[] = [...tree.children]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    if (current.type === 'page' && current.url === selectedPath) return true
    if (current.type === 'folder') stack.push(...current.children)
  }
  return false
}

function getExpandedFolderPaths({
  selectedPath,
  capabilityKey,
  keyType,
  isFile,
}: {
  selectedPath: string
  capabilityKey: string
  keyType: KeyType
  isFile: boolean
}) {
  const prefix = `/${keyType}/${capabilityKey}/`
  if (!selectedPath.startsWith(prefix)) return new Set<string>()

  const relativePath = selectedPath.slice(prefix.length)
  if (!relativePath) return new Set<string>()

  const segments = relativePath.split('/').filter(Boolean)
  const maxDepth = isFile ? Math.max(segments.length - 1, 0) : segments.length
  const expanded = new Set<string>()
  let current = ''

  for (let index = 0; index < maxDepth; index += 1) {
    current = current ? `${current}/${segments[index]}` : segments[index]
    expanded.add(current)
  }

  return expanded
}

function TreeNode({
  node,
  selectedPath,
  parentPath = '',
}: {
  node: PageTreeNode
  selectedPath: string
  parentPath?: string
}) {
  if (node.type === 'page') {
    const isSelected = selectedPath === node.url
    return (
      <FileTreeFile
        path={node.url}
        name={node.name}
        icon={getFileIcon(node.name)}
        className={cn(isSelected && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary')}
      />
    )
  }

  const folderPath = parentPath ? `${parentPath}/${node.name}` : node.name

  return (
    <FileTreeFolder path={folderPath} name={node.name}>
      {node.children.map((child, i) => (
        <TreeNode
          key={child.type === 'page' ? child.url : `${child.name}-${i}`}
          node={child}
          selectedPath={selectedPath}
          parentPath={folderPath}
        />
      ))}
    </FileTreeFolder>
  )
}

function RuntimeSidebarBody({
  pageTree,
  pathname,
  keyType,
  capabilityKey,
  workspace,
}: {
  pageTree: PageTreeRoot
  pathname: string
  keyType: KeyType
  capabilityKey: string
  workspace?: WorkspaceContext | null
}) {
  const { setOpen, mode, collapsed } = useSidebarContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [writeKeyInput, setWriteKeyInput] = useState('')
  const showClaimAction = workspace?.claimed === false
  const isWorkspaceEmpty = pageTree.children.length === 0
  const isFilePath = useMemo(() => hasFileNodeAtPath(pageTree, pathname), [pageTree, pathname])
  const workspaceHeading = useMemo(() => {
    const namedWorkspace = workspace?.name?.trim()
    if (namedWorkspace) return namedWorkspace

    const workspaceId = workspace?.id?.trim()
    if (workspaceId) return workspaceId

    const treeName = pageTree.name?.trim()
    if (treeName) return treeName

    return 'Workspace'
  }, [pageTree.name, workspace?.id, workspace?.name])
  const resolvedWriteKey = extractWriteKey(writeKeyInput)
  const runtimeRootPath = `/${keyType}/${capabilityKey}`
  const isRuntimeRoot = pathname === runtimeRootPath
  const isOrchestrationView = isRuntimeRoot && searchParams.get('view') === 'orchestration'
  const defaultExpanded = useMemo(
    () =>
      getExpandedFolderPaths({
        selectedPath: pathname,
        capabilityKey,
        keyType,
        isFile: isFilePath,
      }),
    [capabilityKey, isFilePath, keyType, pathname]
  )

  function handleClaimContinue() {
    if (!resolvedWriteKey) return
    setClaimDialogOpen(false)
    setWriteKeyInput('')
    setOpen(false)
    router.push(`/claim/${resolvedWriteKey}`)
  }

  function handleClaimSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleClaimContinue()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex">
          <Link
            href={`/${keyType}/${capabilityKey}`}
            className="me-auto inline-flex items-center gap-2 text-[0.9375rem] font-medium"
            onClick={() => setOpen(false)}
          >
            <Logo />
          </Link>
          {mode === 'full' ? (
            <SidebarCollapseTrigger
              className={`${sidebarCollapseButtonClassName} mb-auto`}
            >
              <PanelLeft />
            </SidebarCollapseTrigger>
          ) : null}
        </div>
      </div>

      <SidebarViewport contentClassName="py-4 pl-1 pr-4">
        <p
          data-slot="sidebar-section-title"
          data-testid="reader-workspace-heading"
          className="mb-1.5 inline-flex max-w-full items-center gap-2 truncate px-2 text-foreground empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0"
          style={{ paddingInlineStart: 'calc(2 * var(--spacing))' }}
        >
          {workspaceHeading}
        </p>
        {isWorkspaceEmpty ? (
          <div
            data-testid="sidebar-empty-state"
            className="rounded-md border border-border/70 bg-muted/30 px-3 py-3 text-xs text-muted-foreground"
          >
            <p className="font-medium text-foreground">No files yet</p>
            <p className="mt-1">
              Create your first markdown file from the runtime onboarding panel.
            </p>
          </div>
        ) : (
          <FileTree
            key={pathname}
            defaultExpanded={defaultExpanded}
            selectedPath={pathname}
            onSelect={(path) => {
              setOpen(false)
              router.push(path)
            }}
            className="p-0"
          >
            {pageTree.children.map((node, i) => (
              <TreeNode
                key={node.type === 'page' ? node.url : `${node.name}-${i}`}
                node={node}
                selectedPath={pathname}
              />
            ))}
          </FileTree>
        )}
      </SidebarViewport>

      <SidebarFooter>
        <Button
          variant="ghost"
          data-testid="reader-orchestration-button"
          className={cn(
            'h-auto w-full justify-start gap-2 rounded-lg p-2 text-start text-muted-foreground transition-[color,box-shadow] hover:bg-accent/50 hover:text-accent-foreground/80 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            isOrchestrationView && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
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
            {showClaimAction ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="claim-workspace-button"
                  aria-label="Claim"
                  title="Claim workspace"
                  onClick={() => setClaimDialogOpen(true)}
                  className="text-muted-foreground"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Claim</span>
                </Button>
                <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Claim workspace</DialogTitle>
                      <DialogDescription>
                        Paste the workspace write key to continue through OAuth and bind ownership.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleClaimSubmit} className="space-y-4">
                      <Input
                        value={writeKeyInput}
                        onChange={(event) => setWriteKeyInput(event.target.value)}
                        placeholder="Paste write key or /claim URL"
                        autoFocus
                      />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setClaimDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={!resolvedWriteKey}>
                          Continue
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </div>
          <ThemeToggle className="ms-auto p-0" />
        </div>
      </SidebarFooter>
    </div>
  )
}

export function ReaderDocsLayout({
  pageTree,
  keyType,
  capabilityKey,
  workspace,
  children,
}: ReaderDocsLayoutProps) {
  const pathname = usePathname()
  const { isOwner, workspaceId } = useIsOwner(capabilityKey)

  return (
    <div data-testid="reader-layout" className="flex min-h-screen flex-col">
      {isOwner && workspaceId ? <OwnerBanner workspaceId={workspaceId} /> : null}
      <div className="min-h-0 flex-1">
        <WorkspaceShell
          className="max-md:[--shell-header-height:3.5rem]"
          secondaryWidth="268px"
          sidebar={(
            <>
              <SidebarContent>
                <RuntimeSidebarBody
                  pageTree={pageTree}
                  pathname={pathname}
                  keyType={keyType}
                  capabilityKey={capabilityKey}
                  workspace={workspace}
                />
              </SidebarContent>
              <SidebarDrawer>
                <RuntimeSidebarBody
                  pageTree={pageTree}
                  pathname={pathname}
                  keyType={keyType}
                  capabilityKey={capabilityKey}
                  workspace={workspace}
                />
              </SidebarDrawer>
            </>
          )}
          mobileHeader={(
            <header className="[grid-area:header] sticky top-[var(--shell-row-1)] z-30 flex h-[var(--shell-header-height)] items-center border-b border-border bg-background/80 ps-4 pe-2.5 backdrop-blur-sm transition-colors md:hidden">
              <Link
                href={`/${keyType}/${capabilityKey}`}
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                <Logo />
              </Link>
              <SidebarTrigger className="ms-auto inline-flex items-center rounded-lg p-2 text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground/80">
                <PanelLeft className="size-4" />
              </SidebarTrigger>
            </header>
          )}
        >
          {children}
        </WorkspaceShell>
      </div>
    </div>
  )
}

