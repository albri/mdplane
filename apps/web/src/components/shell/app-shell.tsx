'use client'

import { cn } from '@mdplane/ui/lib/utils'
import { SidebarProvider, useSidebarContext } from './sidebar-context'

interface BaseShellProps {
  sidebar: React.ReactNode
  mobileHeader?: React.ReactNode
  mobileSupplement?: React.ReactNode
  children: React.ReactNode
  className?: string
  layoutWidth?: string
  sidebarWidth?: string
  secondaryWidth?: string
}

interface ShellFrameProps extends BaseShellProps {}

function ShellFrame({
  sidebar,
  mobileHeader,
  mobileSupplement,
  children,
  className,
  layoutWidth = '97rem',
  sidebarWidth = '268px',
  secondaryWidth = '0px',
}: ShellFrameProps) {
  const { collapsed, mode } = useSidebarContext()
  const sidebarColumn = mode === 'drawer' || collapsed ? '0px' : 'var(--shell-sidebar-width)'

  return (
    <div
      id="shell-layout"
      data-sidebar-collapsed={collapsed}
      className={cn(
        'grid min-h-[var(--shell-height)] auto-cols-auto auto-rows-auto overflow-x-clip bg-background transition-[grid-template-columns] [--shell-height:100dvh] [--shell-header-height:0px] [--shell-sidebar-width:0px] [--shell-secondary-popover-height:0px] [--shell-secondary-width:0px]',
        className
      )}
      style={{
        ['--shell-layout-width' as string]: layoutWidth,
        ['--shell-sidebar-width' as string]: sidebarWidth,
        ['--shell-secondary-width' as string]: secondaryWidth,
        ['--shell-row-1' as string]: 'var(--shell-banner-height, 0px)',
        ['--shell-row-2' as string]: 'calc(var(--shell-row-1) + var(--shell-header-height))',
        ['--shell-row-3' as string]: 'calc(var(--shell-row-2) + var(--shell-secondary-popover-height))',
        ['--shell-sidebar-col' as string]: sidebarColumn,
        gridTemplate: `"sidebar header secondary"
          "sidebar secondary-popover secondary"
          "sidebar main secondary" 1fr / minmax(var(--shell-sidebar-col), 1fr) minmax(0, calc(var(--shell-layout-width) - var(--shell-sidebar-width) - var(--shell-secondary-width))) minmax(min-content, 1fr)`,
      }}
    >
      {sidebar}
      {mobileHeader}
      {mobileSupplement}
      {children}
    </div>
  )
}

function ShellRoot(props: BaseShellProps) {
  return (
    <SidebarProvider>
      <ShellFrame {...props} />
    </SidebarProvider>
  )
}

type WorkspaceShellProps = BaseShellProps

export function WorkspaceShell(props: WorkspaceShellProps) {
  return <ShellRoot {...props} />
}

interface ControlShellLayoutProps
  extends Omit<BaseShellProps, 'secondaryWidth' | 'mobileSupplement'> {
  secondaryGutterWidth?: string
}

export function ControlShellLayout({
  secondaryGutterWidth = '268px',
  ...props
}: ControlShellLayoutProps) {
  return <ShellRoot {...props} secondaryWidth={secondaryGutterWidth} />
}

