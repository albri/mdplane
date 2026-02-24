'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth'
import { CONTROL_FRONTEND_ROUTES, WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'
import { Button, buttonVariants } from '@mdplane/ui/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@mdplane/ui/ui/popover'
import { ThemeToggle } from '@mdplane/ui/ui/theme-toggle'
import {
  ControlShellLayout,
  SidebarContent,
  SidebarCollapseTrigger,
  SidebarDrawer,
  SidebarFooter,
  SidebarItem,
  SidebarSection,
  SidebarViewport,
  SidebarTrigger,
  AppFooter,
  useSidebarContext,
} from '@/components/shell'
import { sidebarCollapseButtonClassName } from '@/components/shell/sidebar-styles'
import { WorkspaceSwitcher } from './workspace-switcher'
import { Logo } from '@mdplane/ui/brand/logo'
import { useWorkspaces } from '@/contexts/workspace-context'
import { extractControlWorkspaceId } from '@/lib/control-workspace-routing'
import {
  PanelLeft,
  ExternalLink,
  Settings,
  SquareKanban,
  House,
  Key,
  LogOut,
  Webhook,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

function SidebarBody() {
  const { user, logout } = useAuth()
  const { selectedWorkspace } = useWorkspaces()
  const { mode } = useSidebarContext()
  const workspaceId = selectedWorkspace?.id
  const workspaceRootHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.workspace(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const navItems: NavItem[] = workspaceId
    ? [
        { href: CONTROL_FRONTEND_ROUTES.workspace(workspaceId), label: 'Welcome', icon: House },
        { href: CONTROL_FRONTEND_ROUTES.webhooks(workspaceId), label: 'Webhooks', icon: Webhook },
        { href: CONTROL_FRONTEND_ROUTES.orchestration(workspaceId), label: 'Orchestration', icon: SquareKanban },
        { href: CONTROL_FRONTEND_ROUTES.apiKeys(workspaceId), label: 'API Keys', icon: Key },
        { href: CONTROL_FRONTEND_ROUTES.settings(workspaceId), label: 'Settings', icon: Settings },
      ]
    : []

  const username = user?.name?.trim() || (user?.email ?? '').split('@')[0] || 'user'
  const initials = username.slice(0, 2).toUpperCase()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 py-4">
        <div className="flex">
          <Link
            href={workspaceRootHref}
            className="me-auto inline-flex items-center gap-2 text-[0.9375rem] font-medium"
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

      <WorkspaceSwitcher />

      <SidebarViewport contentClassName="space-y-6 p-4">
        <SidebarSection title="Control">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <SidebarItem href={item.href} label={item.label} icon={item.icon} />
              </li>
            ))}
          </ul>
        </SidebarSection>

        <SidebarSection title="Workspace" className="mt-6">
          <ul className="flex flex-col gap-1">
            <li>
              <SidebarItem
                href={WORKSPACE_FRONTEND_ROUTES.launch}
                icon={ExternalLink}
                label="Workspace Launcher"
                className="text-muted-foreground"
              />
            </li>
          </ul>
        </SidebarSection>
      </SidebarViewport>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 rounded-md p-0" aria-label="Open account menu">
                <Avatar className="h-7 w-7 rounded-md">
                  {user?.image ? <AvatarImage src={user.image} alt={username} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="space-y-1 rounded-md border border-border/70 bg-muted/30 p-3">
                <p className="text-sm font-medium">{username}</p>
                {user?.email ? (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                className="mt-2 w-full justify-start gap-2"
                onClick={() => logout()}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </PopoverContent>
          </Popover>

          <ThemeToggle className="ms-auto p-0" />
        </div>
      </SidebarFooter>
    </div>
  )
}

export function ControlSidebar() {
  return (
    <>
      <SidebarContent>
        <SidebarBody />
      </SidebarContent>
      <SidebarDrawer>
        <SidebarBody />
      </SidebarDrawer>
    </>
  )
}

export function ControlShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const workspaceId = extractControlWorkspaceId(pathname)
  const workspaceRootHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.workspace(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root

  return (
    <ControlShellLayout
      sidebar={<ControlSidebar />}
      mobileHeader={(
        <header className="[grid-area:header] sticky top-[var(--shell-row-1)] z-30 flex h-[var(--shell-header-height)] items-center border-b border-border bg-background/80 ps-4 pe-2.5 backdrop-blur-sm transition-colors md:hidden max-md:[--shell-header-height:3.5rem]">
          <Link
            href={workspaceRootHref}
            className="inline-flex items-center gap-2 text-sm font-semibold"
          >
            <Logo />
          </Link>
          <SidebarTrigger
            className={buttonVariants({
              variant: 'ghost',
              size: 'icon-sm',
              className: 'ms-auto p-2',
            })}
          >
            <PanelLeft className="size-4" />
          </SidebarTrigger>
        </header>
      )}
    >
      <main className="mx-auto flex w-full max-w-[980px] flex-col [grid-area:main] gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14">
        {children}
        <AppFooter />
      </main>
    </ControlShellLayout>
  )
}

