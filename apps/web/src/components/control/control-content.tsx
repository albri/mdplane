'use client'

import { cn } from '@mdplane/ui/lib/utils'

interface ControlContentProps {
  children: React.ReactNode
  className?: string
}

export function ControlContent({ children, className }: ControlContentProps) {
  return <section className={cn('flex w-full flex-col gap-6', className)}>{children}</section>
}

interface ControlToolbarProps {
  children: React.ReactNode
  className?: string
}

export function ControlToolbar({ children, className }: ControlToolbarProps) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  )
}

