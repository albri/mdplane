'use client'

import { AlertCircle } from 'lucide-react'
import type { KeyType } from './types'
import { FolderListSkeleton } from '@/components/ui/skeletons'
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
        icon={<AlertCircle />}
        iconVariant="error"
        headline={title}
        description={message}
        primaryAction={{ label: 'Try again', onClick: () => window.location.reload() }}
      />
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
        icon={<AlertCircle />}
        iconVariant="warning"
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

