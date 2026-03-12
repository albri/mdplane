'use client'

import { useState } from 'react'
import { useFileContent } from '@/hooks/use-file-content'
import { LoadingState, ErrorState, NotFoundState, isNotFoundError } from '@/components/reader'
import { AppFooter } from '@/components/shell'
import { MarkdownRenderer } from '@/components/reader/markdown-renderer'
import { WriteFileActions } from '@/components/write/write-file-actions'
import { FileEditor } from '@/components/write/file-editor'

interface WriteFileViewPageProps {
  capabilityKey: string
  filePath: string
}

export function WriteFileViewPage({
  capabilityKey,
  filePath,
}: WriteFileViewPageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const { data, isLoading, isError, error, refetch } = useFileContent(
    capabilityKey,
    filePath,
    'w'
  )

  const mainShellClassName = 'flex w-full max-w-[900px] mx-auto min-w-0 flex-col [grid-area:main] gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14'
  const fileName = filePath.split('/').pop() || 'file.md'

  if (isLoading) {
    return (
      <article className={mainShellClassName}>
        <LoadingState message="Loading file..." />
        <AppFooter />
      </article>
    )
  }

  if (isError) {
    const errorMessage = error?.message || 'Unknown error'
    if (isNotFoundError(errorMessage)) {
      return (
        <article className={mainShellClassName}>
          <NotFoundState capabilityKey={capabilityKey} keyType="w" itemType="file" />
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

  const content = data?.content || ''

  return (
    <article className={mainShellClassName}>
      <WriteFileActions
        capabilityKey={capabilityKey}
        filePath={filePath}
        fileName={fileName}
        isEditing={isEditing}
        onEditToggle={() => setIsEditing(!isEditing)}
        onSaved={refetch}
      />

      {isEditing ? (
        <FileEditor
          capabilityKey={capabilityKey}
          filePath={filePath}
          initialContent={content}
          onSave={() => {
            setIsEditing(false)
            refetch()
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div className="border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_var(--foreground)]">
          <MarkdownRenderer content={content} />
        </div>
      )}

      <AppFooter />
    </article>
  )
}

