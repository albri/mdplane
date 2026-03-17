'use client'

import { EmptyState } from '@/components/ui/empty-state'
import { AlertTriangle } from 'lucide-react'

interface OrchestrationErrorProps {
  onRetry: () => void
}

export function OrchestrationError({ onRetry }: OrchestrationErrorProps) {
  return (
    <div
      role="alert"
      data-testid="orchestration-error-state"
    >
      <EmptyState
        icon={<AlertTriangle className="h-12 w-12" />}
        headline="Couldn't load tasks"
        description="Try again."
        primaryAction={{ label: 'Try again', onClick: onRetry }}
        className="rounded-none border-0 bg-transparent py-16 shadow-none"
      />
    </div>
  )
}


