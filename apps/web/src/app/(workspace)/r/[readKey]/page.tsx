import { FolderViewPage } from './[...path]/folder-view-page'
import { RuntimeOrchestrationPage } from './runtime-orchestration-page'
import { z } from 'zod'

interface WorkspaceRootPageProps {
  params: Promise<{ readKey: string }>
  searchParams: Promise<{ view?: string }>
}

const searchParamsSchema = z.object({
  view: z.enum(['orchestration']).optional(),
})

export default async function WorkspaceRootPage({ params, searchParams }: WorkspaceRootPageProps) {
  const { readKey } = await params
  const parsedSearchParams = searchParamsSchema.safeParse(await searchParams)

  if (parsedSearchParams.success && parsedSearchParams.data.view === 'orchestration') {
    return <RuntimeOrchestrationPage readKey={readKey} />
  }

  return <FolderViewPage capabilityKey={readKey} keyType="r" folderPath="" />
}
