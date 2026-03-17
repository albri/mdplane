'use client'

import { useEffect, useState } from 'react'
import {
  ControlContent,
  ControlHeader,
  ExportSection,
  DangerZone,
} from '@/components/control'
import { Button } from '@mdplane/ui/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkspaces } from '@/contexts/workspace-context'
import { useRenameWorkspace, useToast } from '@/hooks'

export default function SettingsPage() {
  const { selectedWorkspace } = useWorkspaces()
  const toast = useToast()
  const renameMutation = useRenameWorkspace(selectedWorkspace?.id ?? null)
  const [workspaceName, setWorkspaceName] = useState('')

  useEffect(() => {
    setWorkspaceName(selectedWorkspace?.name ?? '')
  }, [selectedWorkspace?.name])

  const trimmedWorkspaceName = workspaceName.trim()
  const isNameUnchanged = trimmedWorkspaceName === (selectedWorkspace?.name ?? '')

  const handleRenameWorkspace = async () => {
    try {
      await renameMutation.mutateAsync(trimmedWorkspaceName)
      toast.success({
        title: 'Workspace name updated',
        description: 'The new name is now visible across control surfaces.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename workspace'
      toast.error({
        title: 'Rename failed',
        description: message,
      })
    }
  }

  return (
    <div className="flex flex-col">
      <ControlHeader
        title="Settings"
        description="Manage workspace identity, export, and key lifecycle controls"
      />

      <ControlContent className="flex flex-col gap-8">
        <section>
          <Card tone="muted">
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>Set the workspace name shown across control and runtime surfaces.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Enter workspace name"
                  disabled={renameMutation.isPending}
                />
              </div>
              <Button
                onClick={handleRenameWorkspace}
                disabled={!trimmedWorkspaceName || isNameUnchanged || renameMutation.isPending}
              >
                {renameMutation.isPending ? 'Saving...' : 'Save Name'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Root capability keys are shown at bootstrap and after rotation only. Store them securely when displayed.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card tone="muted">
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>Download your workspace as a ZIP using an export API key.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ExportSection />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card tone="muted" className="border-destructive/40 bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                High-impact actions that immediately affect access and workspace integrity.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <DangerZone />
            </CardContent>
          </Card>
        </section>
      </ControlContent>
    </div>
  )
}

