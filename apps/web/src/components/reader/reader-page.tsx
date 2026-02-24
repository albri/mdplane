'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CAPABILITY_ROUTES, type KeyType } from '@mdplane/shared'
import { extractTocFromMarkdown } from '@/lib/reader/toc-utils'
import { ReaderMarkdown } from './reader-markdown'
import { ReaderToc, ReaderTocPopover } from './reader-toc'
import { LLMCopyButton } from './reader-actions'
import { DocumentSkeleton } from '@/components/ui/skeletons'
import { EmptyState } from '@/components/ui/empty-state'
import { AppFooter } from '@/components/shell'
import type { FileContentData as ReaderFileContentData } from '@/lib/capability/fetch-folder-tree'
import { capabilityProxyRoute } from '@/lib/capability/proxy-route'
import {
  estimateReadingTimeMinutes,
  formatFileDisplayName,
  formatFileSize,
  formatUpdatedTimestamp,
} from './reader-file-meta'
import { AlertTriangle } from 'lucide-react'
export type { FileContentData } from '@/lib/capability/fetch-folder-tree'

interface ReaderPageProps {
  capabilityKey: string
  keyType: KeyType
  path: string
  fileName?: string
  initialData?: ReaderFileContentData
}

interface FileReadResponse {
  ok: boolean
  data?: ReaderFileContentData
  error?: { message: string }
}

export function ReaderPage({
  capabilityKey,
  keyType,
  path,
  fileName,
  initialData,
}: ReaderPageProps) {
  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const fileRoute = encodedPath
    ? `${CAPABILITY_ROUTES.byKeyType(keyType, encodeURIComponent(capabilityKey))}/${encodedPath}`
    : CAPABILITY_ROUTES.byKeyType(keyType, encodeURIComponent(capabilityKey))
  const fileUrl = `${capabilityProxyRoute(fileRoute)}?format=parsed&appends=50`
  const mainShellClassName = 'mx-auto flex w-full max-w-[900px] flex-col [grid-area:main] gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14'

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['file-content', keyType, capabilityKey, path],
    queryFn: async () => {
      const res = await fetch(fileUrl)
      const json: FileReadResponse = await res.json()
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error?.message || 'Failed to load file')
      }
      return json.data
    },
    enabled: !!capabilityKey && !!path,
    initialData,
    staleTime: initialData ? 30_000 : 0,
  })

  const toc = useMemo(() => {
    if (!data?.content) return []
    return extractTocFromMarkdown(data.content)
  }, [data?.content])
  const shouldShowToc = toc.filter((item) => item.depth > 1).length >= 2

  if (isLoading && !initialData) {
    return (
      <article
        data-testid="reader-main"
        className={mainShellClassName}
      >
        <DocumentSkeleton />
      </article>
    )
  }

  if (isError) {
    return (
      <article data-testid="reader-main" className={mainShellClassName}>
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12" />}
          headline="Error loading file"
          description={error instanceof Error ? error.message : 'Unknown error'}
          primaryAction={{ label: 'Try again', onClick: () => window.location.reload() }}
        />
      </article>
    )
  }

  if (!data) {
    return null
  }

  const fileDisplayName = formatFileDisplayName(fileName || path.split('/').at(-1))
  const fileSize = formatFileSize(data.size)
  const updatedAt = formatUpdatedTimestamp(data.updatedAt)
  const readingTimeMinutes = estimateReadingTimeMinutes(data.content)

  return (
    <>
      {shouldShowToc ? <ReaderTocPopover items={toc} /> : null}

      <article
        data-testid="reader-main"
        className={mainShellClassName}
      >
        <header className="mb-8 flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-6">
          <div className="space-y-1">
            <h1 data-testid="reader-file-title" className="text-[1.75em] font-semibold">
              {fileDisplayName}
            </h1>
            <p data-testid="reader-file-meta" className="text-sm text-muted-foreground">
              <span>{fileSize}</span>
              <span className="px-2 text-border">•</span>
              <span>Updated {updatedAt}</span>
              <span className="px-2 text-border">•</span>
              <span>{readingTimeMinutes} min read</span>
            </p>
          </div>
          <LLMCopyButton markdownContent={data.content} />
        </header>
        <ReaderMarkdown content={data.content} appends={data.appends} />
        <AppFooter />
      </article>

      {shouldShowToc ? (
        <aside
          id="reader-toc"
          data-testid="reader-toc"
          className="sticky top-[var(--shell-row-1)] hidden h-[calc(var(--shell-height)-var(--shell-row-1))] w-[var(--shell-secondary-width)] flex-col [grid-area:secondary] pe-4 pt-12 pb-2 max-xl:hidden xl:flex"
        >
          <ReaderToc items={toc} />
        </aside>
      ) : null}
    </>
  )
}

