'use client'

import { cn } from '@mdplane/ui/lib/utils'
import { TaskCard } from './task-card'
import type { OrchestrationTask } from '@/hooks'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@mdplane/ui/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface OrchestrationSectionProps {
  title: string
  icon?: ReactNode
  count: number
  tasks: OrchestrationTask[]
  customContent?: ReactNode
  getTaskHref?: (task: OrchestrationTask) => string | null
  headerAccentClassName?: string
  iconClassName?: string
  emptyMessage?: string
  collapsible?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  showTakeAction?: boolean
  onTakeAction?: (task: OrchestrationTask) => void
}

export function OrchestrationSection({
  title,
  icon,
  count,
  tasks,
  customContent,
  getTaskHref,
  headerAccentClassName = 'bg-primary/50',
  iconClassName,
  emptyMessage = 'No tasks in this section.',
  collapsible = false,
  collapsed = false,
  onToggleCollapsed,
  showTakeAction = false,
  onTakeAction,
}: OrchestrationSectionProps) {
  const isCollapsed = collapsible && collapsed

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-secondary shadow-sm">
      <header className="flex w-full items-center gap-3 px-4 text-secondary-foreground">
        <span className={cn('h-5 w-0.5 shrink-0 rounded-sm', headerAccentClassName)} aria-hidden />
        <div className={cn('flex items-center gap-2 py-3 text-sm font-semibold leading-none text-foreground', iconClassName)}>
          {icon ? <span aria-hidden>{icon}</span> : null}
          <span>{title}</span>
        </div>
        <Badge variant="outline" className="ml-auto rounded-md bg-card px-1.5 py-0.5 text-xs text-muted-foreground">
          {count}
        </Badge>
        {collapsible ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="-mr-1.5"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        ) : null}
      </header>

      {!isCollapsed ? (
        <div className="rounded-xl bg-card p-4">
          {customContent ? customContent : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard
                  key={`${task.id}:${task.file.path}:${task.createdAt}`}
                  task={task}
                  taskHref={getTaskHref?.(task)}
                  showTakeAction={showTakeAction}
                  onTakeAction={onTakeAction}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

