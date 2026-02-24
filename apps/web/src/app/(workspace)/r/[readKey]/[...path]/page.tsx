import { Suspense } from 'react'
import { ReaderPage } from '@/components/reader'
import { fetchFileContent } from '@/lib/capability/fetch-folder-tree'
import { FolderViewPage } from './folder-view-page'
import { DocumentSkeleton } from '@/components/ui/skeletons'

function looksLikeFilePath(path: string): boolean {
  const last = path.split('/').pop() || ''
  return last.includes('.')
}

interface FileContentProps {
  capabilityKey: string
  path: string
  fileName?: string
}

async function FileContent({ capabilityKey, path, fileName }: FileContentProps) {
  const initialData = await fetchFileContent(capabilityKey, 'r', path)

  return (
    <ReaderPage
      capabilityKey={capabilityKey}
      keyType="r"
      path={path}
      fileName={fileName}
      initialData={initialData ?? undefined}
    />
  )
}

interface PathPageProps {
  params: Promise<{ readKey: string; path: string[] }>
}

export default async function PathPage({ params }: PathPageProps) {
  const { readKey, path } = await params
  const currentPath = path.join('/')

  const isFile = looksLikeFilePath(currentPath)

  if (isFile) {
    const fileName = path[path.length - 1]

    return (
      <Suspense
        fallback={
          <article className="flex w-full max-w-[900px] mx-auto flex-col [grid-area:main] gap-4 px-4 py-6 md:px-6 md:pt-8 xl:px-8 xl:pt-14">
            <DocumentSkeleton />
          </article>
        }
      >
        <FileContent
          capabilityKey={readKey}
          path={currentPath}
          fileName={fileName}
        />
      </Suspense>
    )
  }

  const folderPath = path.join('/')
  return (
    <FolderViewPage
      capabilityKey={readKey}
      keyType="r"
      folderPath={folderPath}
    />
  )
}
