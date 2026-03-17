'use client'

import { useMemo, useState } from 'react'
import { useWorkspaces } from '@/contexts/workspace-context'
import { Popover, PopoverContent, PopoverTrigger } from '@mdplane/ui/ui/popover'
import { Check, ChevronsUpDown, Building, LayoutGrid } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'

function getWorkspaceName(workspace?: { id: string; name: string | null } | null) {
  const trimmed = workspace?.name?.trim()
  if (!trimmed || trimmed.toLowerCase() === 'untitled') return null
  if (/^workspace(?:\s|$)/i.test(trimmed)) return null
  return trimmed
}

interface WorkspaceOption {
  id: string
  label: string
  description: string | null
}

export function WorkspaceSwitcher() {
  const { workspaces, selectedWorkspace, selectWorkspace, isLoading } = useWorkspaces()
  const [open, setOpen] = useState(false)

  const workspaceOptions = useMemo<WorkspaceOption[]>(() => {
    return workspaces.map((workspace) => {
      const preferredName = getWorkspaceName(workspace)
      return {
        id: workspace.id,
        label: preferredName ?? workspace.id,
        description: preferredName ? workspace.id : null,
      }
    })
  }, [workspaces])

  const selectedWorkspaceId = selectedWorkspace?.id ?? null
  const selectedWorkspaceOption = selectedWorkspaceId
    ? workspaceOptions.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
    : null

  const handleSelectWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId)
    setOpen(false)
  }

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <div className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
          <Building className="h-4 w-4 animate-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building className="h-4 w-4" />
          <span>No workspaces</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-2">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Select workspace"
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'flex h-auto min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-sidebar-border bg-secondary/50 p-2 text-secondary-foreground outline-none transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              open && 'bg-accent text-accent-foreground'
            )}
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/80 bg-muted/60 md:size-5 md:border-0 md:bg-transparent">
              <LayoutGrid className="size-4 text-primary md:size-3.5" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-medium">
                {selectedWorkspaceOption?.label ?? 'Select workspace'}
              </span>
              {selectedWorkspaceOption?.description ? (
                <span className="truncate text-xs text-muted-foreground empty:hidden md:hidden">
                  {selectedWorkspaceOption.description}
                </span>
              ) : null}
            </span>
            <ChevronsUpDown className="size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          role="listbox"
          aria-label="Workspace options"
          className="w-(--anchor-width) max-h-72 overflow-auto p-1"
        >
          {workspaceOptions.map((workspace) => {
            const isSelected = workspace.id === selectedWorkspaceId
            return (
              <button
                key={workspace.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-testid="workspace-switcher-option"
                onClick={() => handleSelectWorkspace(workspace.id)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium leading-none" title={workspace.label}>
                    {workspace.label}
                  </span>
                  {workspace.description ? (
                    <span className="mt-1 block truncate text-[0.8125rem] text-muted-foreground">{workspace.description}</span>
                  ) : null}
                </span>
                <Check className={cn('size-3.5 text-primary', !isSelected && 'invisible')} />
              </button>
            )
          })}
        </PopoverContent>
      </Popover>
    </div>
  )
}

