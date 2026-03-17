'use client'

import { EmptyState } from '@/components/ui/empty-state'
import { CheckCircle } from 'lucide-react'

interface OrchestrationAllDoneProps {
  doneCount: number
}

export function OrchestrationAllDone({ doneCount }: OrchestrationAllDoneProps) {
  return (
    <EmptyState
      icon={<CheckCircle />}
      iconVariant="sage"
      headline="All caught up"
      description={`No pending tasks. ${doneCount > 0 ? `${doneCount} task${doneCount !== 1 ? 's are' : ' is'} completed or cancelled.` : 'Your agents are idle.'}`}
      className="rounded-none border-0 bg-transparent py-16 shadow-none"
    />
  )
}


