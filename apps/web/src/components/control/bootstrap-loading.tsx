'use client'

import { Spinner } from '@/components/ui/spinner'
import { DiagonalStripes, IntersectionMarks } from '@/components/ui/patterns'

interface BootstrapLoadingProps {
  state: 'loading' | 'creating'
  workspaceName?: string | null
}

export function BootstrapLoading({ state, workspaceName }: BootstrapLoadingProps) {
  const message =
    state === 'creating' && workspaceName
      ? `Creating "${workspaceName}"...`
      : state === 'creating'
        ? 'Creating your workspace...'
        : 'Preparing...'

  return (
    <div className="state-shell">
      <DiagonalStripes angle={135} spacing={24} className="opacity-30" />
      <IntersectionMarks size={52} className="opacity-20" />

      <div className="state-shell-content">
        <div className="state-shell-card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12">
            <Spinner size="xl" label={message} />
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}


