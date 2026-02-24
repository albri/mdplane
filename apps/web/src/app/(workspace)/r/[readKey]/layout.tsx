import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { APP_NAME } from '@mdplane/shared'
import { validateCapabilityKey } from '@/lib/capability/validate-key'
import { fetchCompletePageTreeWithWorkspace } from '@/lib/capability/fetch-folder-tree'
import { ReaderDocsLayout } from '@/components/reader'

export const metadata: Metadata = {
  title: 'Shared File',
  description: `View shared content on ${APP_NAME}.`,
  robots: {
    index: false,
    follow: false,
  },
}

export default async function ReadKeyLayout({
  params,
  children,
}: {
  params: Promise<{ readKey: string }>
  children: React.ReactNode
}) {
  const { readKey } = await params

  const validation = await validateCapabilityKey(readKey, 'r')
  if (!validation.valid) {
    notFound()
  }

  const { pageTree, workspace } = await fetchCompletePageTreeWithWorkspace(readKey, 'r')

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ReaderDocsLayout
        pageTree={pageTree}
        keyType="r"
        capabilityKey={readKey}
        workspace={workspace}
      >
        {children}
      </ReaderDocsLayout>
    </Suspense>
  )
}

