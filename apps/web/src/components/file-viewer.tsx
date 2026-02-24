'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { CAPABILITY_ROUTES } from '@mdplane/shared'
import { capabilityProxyRoute } from '@/lib/capability/proxy-route'
import { MarkdownRenderer } from './markdown-renderer'

interface FileViewerProps {
  readKey: string
  pathSegments: string[]
  /** Use 'reader' for document-focused experience in capability views */
  variant?: 'default' | 'reader'
}

type FileReadResponse = {
  ok: boolean
  data?: {
    id: string
    filename: string
    content: string
    etag: string
    createdAt: string
    updatedAt: string
    appendCount: number
    size: number
    appends?: Array<{
      id: string
      author: string
      content: string
      ts: string
      type: 'task' | 'claim' | 'response' | 'comment' | 'blocked' | 'answer' | 'renew' | 'cancel' | 'vote' | 'heartbeat'
    }>
  }
  error?: {
    message: string
  }
}

export default function FileViewer({ readKey, pathSegments, variant = 'default' }: FileViewerProps) {
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/')
  const fileRoute = encodedPath
    ? `${CAPABILITY_ROUTES.read(encodeURIComponent(readKey))}/${encodedPath}`
    : CAPABILITY_ROUTES.read(encodeURIComponent(readKey))
  const fileUrl = capabilityProxyRoute(fileRoute)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['file-content', readKey, encodedPath],
    queryFn: async () => {
      const response = await fetch(fileUrl)
      const data: FileReadResponse = await response.json()
      
      if (!response.ok || !data.ok) {
        throw new Error(data.error?.message || 'Failed to load file')
      }
      
      return data.data
    },
    enabled: !!readKey,
  })

  if (isLoading) {
    return (
      <div data-testid="file-viewer" className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 animate-pulse text-muted-foreground" />
          <span className="text-muted-foreground">Loading file...</span>
        </div>
      </div>
    )
  }

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load file'
    const isNotFound = 
      errorMessage.includes('not found') ||
      errorMessage.includes('404') ||
      errorMessage === 'Invalid or missing capability key' ||
      errorMessage === 'Capability key has been revoked' ||
      errorMessage === 'Capability key has expired'

    return (
      <div data-testid="file-viewer" className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center justify-center max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {isNotFound ? '404 Not Found' : 'Error loading file'}
          </h2>
          <p className="text-muted-foreground mb-4">{errorMessage}</p>
          {isNotFound && (
            <Link
              href={`/r/${readKey}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to workspace root
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div data-testid="file-viewer" className="max-w-4xl">
      <MarkdownRenderer
        content={data.content}
        appends={data.appends}
        variant={variant}
        className={variant === 'reader' ? '' : 'prose prose-slate max-w-none dark:prose-invert'}
      />
    </div>
  )
}
