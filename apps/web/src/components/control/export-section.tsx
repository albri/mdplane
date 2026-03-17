'use client'

import Link from 'next/link'
import { Key, ArrowRight } from 'lucide-react'
import { Button } from '@mdplane/ui/ui/button'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'
import { CommandTabs } from './command-tabs'
import { useWorkspaces } from '@/contexts/workspace-context'

const bashExportCommand =
  'curl "https://api.mdplane.dev/api/v1/export?format=zip" \\\n  -H "Authorization: Bearer YOUR_EXPORT_API_KEY" \\\n  --output workspace.zip'

const cliExportCommand =
  'mdplane export --format zip --output workspace.zip --profile YOUR_PROFILE_WITH_API_KEY'

export function ExportSection() {
  const { selectedWorkspace } = useWorkspaces()
  const apiKeysHref = selectedWorkspace
    ? CONTROL_FRONTEND_ROUTES.apiKeys(selectedWorkspace.id)
    : CONTROL_FRONTEND_ROUTES.root

  return (
    <div className="space-y-4">
      <CommandTabs
        apiCommand={bashExportCommand}
        cliCommand={cliExportCommand}
        copyMode="inline"
        testId="control-export-command"
      />

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href={apiKeysHref}>
            <Key className="h-4 w-4" />
            Create export key
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

