'use client'

import { useFolderContents, type FolderItem } from '@/hooks/use-folder-contents'
import {
  FolderView,
  LoadingState,
  ErrorState,
  NotFoundState,
  isNotFoundError,
  type FolderItem as ReaderFolderItem,
} from '@/components/reader'
import { AppFooter } from '@/components/shell'
import type { KeyType } from '@mdplane/shared'

function convertToReaderFolderItems(items: FolderItem[]): ReaderFolderItem[] {
  return items.map((item) => ({
    name: item.name,
    type: item.type,
    size: item.size,
    childCount: item.childCount,
    updatedAt: item.updatedAt,
  }))
}

interface FolderViewPageProps {
  capabilityKey: string
  keyType: KeyType
  folderPath: string
}

/**
 * Client component for folder view with interactive listing.
 */
export function FolderViewPage({
  capabilityKey,
  keyType,
  folderPath,
}: FolderViewPageProps) {
  const { data, isLoading, isError, error } = useFolderContents(
    capabilityKey,
    folderPath,
    keyType,
    true
  )

  const mainShellClassName = 'flex w-full max-w-[900px] mx-auto min-w-0 flex-col [grid-area:main] gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14'

  if (isLoading) {
    return (
      <article className={mainShellClassName}>
        <LoadingState message="Loading folder..." />
        <AppFooter />
      </article>
    )
  }

  if (isError) {
    const errorMessage = error?.message || 'Unknown error'
    if (isNotFoundError(errorMessage)) {
      return (
        <article className={mainShellClassName}>
          <NotFoundState capabilityKey={capabilityKey} keyType={keyType} itemType="folder" />
          <AppFooter />
        </article>
      )
    }
    return (
      <article className={mainShellClassName}>
        <ErrorState message={errorMessage} />
        <AppFooter />
      </article>
    )
  }

  return (
    <article className={mainShellClassName}>
      <FolderView
        items={convertToReaderFolderItems(data?.items || [])}
        path={folderPath ? `/${folderPath}` : '/'}
        capabilityKey={capabilityKey}
        keyType={keyType}
      />
      <AppFooter />
    </article>
  )
}

