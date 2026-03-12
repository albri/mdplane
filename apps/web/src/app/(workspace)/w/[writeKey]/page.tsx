import { WriteFolderViewPage } from './[...path]/write-folder-view-page'

interface WriteWorkspaceRootPageProps {
  params: Promise<{ writeKey: string }>
}

export default async function WriteWorkspaceRootPage({ params }: WriteWorkspaceRootPageProps) {
  const { writeKey } = await params

  return <WriteFolderViewPage capabilityKey={writeKey} folderPath="" />
}

