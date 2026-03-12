import { WriteFolderViewPage } from './write-folder-view-page'
import { WriteFileViewPage } from './write-file-view-page'

interface WritePathPageProps {
  params: Promise<{ writeKey: string; path: string[] }>
}

export default async function WritePathPage({ params }: WritePathPageProps) {
  const { writeKey, path } = await params
  const fullPath = path.join('/')

  // If path ends with .md or .markdown, render file view
  const isMarkdownFile = fullPath.endsWith('.md') || fullPath.endsWith('.markdown')

  if (isMarkdownFile) {
    return <WriteFileViewPage capabilityKey={writeKey} filePath={fullPath} />
  }

  return <WriteFolderViewPage capabilityKey={writeKey} folderPath={fullPath} />
}

