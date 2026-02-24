'use client'

import { AlertCircle } from 'lucide-react'
import type { KeyType } from './types'
import { FolderListSkeleton } from '@/components/ui/skeletons'
import { AUTH_FRONTEND_ROUTES, WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'
import { EmptyState } from '@/components/ui/empty-state'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message: _message }: LoadingStateProps) {
  return (
    <div className="py-4">
      <FolderListSkeleton rows={6} />
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
}

export function ErrorState({ 
  title = 'Error loading content',
  message 
}: ErrorStateProps) {
  return (
    <div className="py-8">
      <EmptyState
        icon={<AlertCircle className="h-12 w-12" />}
        headline={title}
        description={message}
        primaryAction={{ label: 'Try again', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'Workspace Launcher', href: WORKSPACE_FRONTEND_ROUTES.launch }}
      />

      <div className="mt-3 text-center">
        <a
          href={AUTH_FRONTEND_ROUTES.bootstrap}
          className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Create workspace
        </a>
      </div>
    </div>
  )
}

interface NotFoundStateProps {
  capabilityKey: string
  keyType: KeyType
  itemType?: 'file' | 'folder' | 'path'
}

export function NotFoundState({ 
  capabilityKey, 
  keyType,
  itemType = 'path'
}: NotFoundStateProps) {
  const workspaceRoot = `/${keyType}/${capabilityKey}`

  return (
    <div className="py-8">
      <EmptyState
        icon={<AlertCircle className="h-12 w-12" />}
        headline="404 Not Found"
        description={`The ${itemType} you are looking for does not exist or you do not have access to it.`}
        primaryAction={{ label: 'Go to workspace root', href: workspaceRoot }}
      />
    </div>
  )
}

export function isNotFoundError(errorMessage: string | undefined): boolean {
  if (!errorMessage) return false
  return (
    errorMessage === 'Folder not found' ||
    errorMessage === 'File not found' ||
    errorMessage === 'Invalid or missing capability key' ||
    errorMessage === 'Capability key has been revoked' ||
    errorMessage === 'Capability key has expired'
  )
}

