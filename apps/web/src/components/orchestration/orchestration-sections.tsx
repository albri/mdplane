'use client'

import type { OrchestrationData, OrchestrationStatus, OrchestrationTask } from '@/hooks'
import { OrchestrationSection } from './orchestration-section'
import { ORCHESTRATION_STATUS_META, ORCHESTRATION_STATUS_ORDER } from './orchestration-meta'

interface OrchestrationSectionsProps {
  data: OrchestrationData
  getTaskHref?: (task: OrchestrationTask) => string | null
  showTakeAction?: boolean
  onTakeAction?: (task: OrchestrationTask) => void
}

function tasksForStatus(tasks: OrchestrationTask[], status: OrchestrationStatus): OrchestrationTask[] {
  return tasks.filter((task) => task.status === status)
}

export function OrchestrationSections({
  data,
  getTaskHref,
  showTakeAction = false,
  onTakeAction,
}: OrchestrationSectionsProps) {
  return (
    <div className='space-y-4'>
      {ORCHESTRATION_STATUS_ORDER.map((status) => {
        const meta = ORCHESTRATION_STATUS_META[status]
        const tasks = tasksForStatus(data.tasks, status)
        const Icon = meta.icon
        const allowTakeAction = showTakeAction && (status === 'claimed' || status === 'stalled')

        return (
          <OrchestrationSection
            key={status}
            title={meta.label}
            icon={<Icon className='h-4 w-4' />}
            iconClassName={meta.iconClassName}
            headerAccentClassName={meta.accentClassName}
            count={data.summary[status]}
            tasks={tasks}
            getTaskHref={getTaskHref}
            emptyMessage={meta.emptyMessage}
            showTakeAction={allowTakeAction}
            onTakeAction={allowTakeAction ? onTakeAction : undefined}
          />
        )
      })}
    </div>
  )
}
