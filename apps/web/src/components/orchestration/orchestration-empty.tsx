'use client'

import { EmptyState } from '@/components/ui/empty-state'
import { LayoutGrid } from 'lucide-react'
import { URLS, WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'

export function OrchestrationEmpty() {
  return (
    <div data-testid="orchestration-empty-state">
      <EmptyState
        icon={<LayoutGrid className="h-12 w-12" />}
        headline="No tasks yet"
        description="Tasks appear when agents create task appends in your workspace."
        primaryAction={{ label: 'Task docs', href: `${URLS.DOCS}/docs/orchestration` }}
        secondaryAction={{ label: 'Workspace Launcher', href: WORKSPACE_FRONTEND_ROUTES.launch }}
        className="rounded-none border-0 bg-transparent py-16 shadow-none"
      />
    </div>
  )
}


