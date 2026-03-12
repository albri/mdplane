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
import { WriteFolderActions } from '@/components/write/write-folder-actions'
import { EmptyFolderState } from '@/components/write/empty-folder-state'

function convertToReaderFolderItems(items: FolderItem[]): ReaderFolderItem[] {
  return items.map((item) => ({
    name: item.name,
    type: item.type,
    size: item.size,
    childCount: item.childCount,
    updatedAt: item.updatedAt,
  }))
}

interface WriteFolderViewPageProps {
  capabilityKey: string
  folderPath: string
}

export function WriteFolderViewPage({
  capabilityKey,
  folderPath,
}: WriteFolderViewPageProps) {
  const { data, isLoading, isError, error, refetch } = useFolderContents(
    capabilityKey,
    folderPath,
    'w',
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
          <NotFoundState capabilityKey={capabilityKey} keyType="w" itemType="folder" />
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

  const items = data?.items || []
  const isEmpty = items.length === 0

  return (
    <article className={mainShellClassName}>
      <WriteFolderActions 
        capabilityKey={capabilityKey} 
        folderPath={folderPath}
        onFileCreated={refetch}
      />
      
      {isEmpty ? (
        <EmptyFolderState 
          capabilityKey={capabilityKey} 
          folderPath={folderPath}
          onFileCreated={refetch}
        />
      ) : (
        <FolderView
          items={convertToReaderFolderItems(items)}
          path={folderPath ? `/${folderPath}` : '/'}
          capabilityKey={capabilityKey}
          keyType="w"
        />
      )}
      
      <AppFooter />
    </article>
  )
}

