'use client'

import {
  SidebarContent,
  SidebarDrawer,
  SidebarTrigger,
  WorkspaceShell,
} from '@/components/shell'
import { useIsOwner } from '@/hooks/use-is-owner'
import type { PageTreeRoot, WorkspaceContext } from '@/lib/capability/fetch-folder-tree'
import type { KeyType } from '@mdplane/shared'
import { ThemedLogo } from '@mdplane/ui'
import { PanelLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ReaderSidebar } from './reader-sidebar'

interface ReaderDocsLayoutProps {
  pageTree: PageTreeRoot
  keyType: KeyType
  capabilityKey: string
  workspace?: WorkspaceContext | null
  children: ReactNode
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
      <div className="min-h-0 flex-1">
        <WorkspaceShell
          className="max-md:[--shell-header-height:3.5rem]"
          secondaryWidth="268px"
          sidebar={(
            <>
              <SidebarContent>
                <ReaderSidebar
                  pageTree={pageTree}
                  pathname={pathname}
                  keyType={keyType}
                  capabilityKey={capabilityKey}
                  workspace={workspace}
                  isOwner={isOwner}
                  ownerWorkspaceId={workspaceId ?? undefined}
                />
              </SidebarContent>
              <SidebarDrawer>
                <ReaderSidebar
                  pageTree={pageTree}
                  pathname={pathname}
                  keyType={keyType}
                  capabilityKey={capabilityKey}
                  workspace={workspace}
                  isOwner={isOwner}
                  ownerWorkspaceId={workspaceId ?? undefined}
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
                <ThemedLogo />
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
