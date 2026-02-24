'use client'

import { useState } from 'react'
import type { BootstrapResponse, Error as ApiError } from '@mdplane/shared'
import { getApiBaseUrl } from '@/lib/api-url'
import {
  BootstrapError,
  BootstrapLoading,
  WorkspaceCreatedState,
} from '@/components/control'
import { Button } from '@mdplane/ui/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DiagonalStripes, IntersectionMarks } from '@/components/ui/patterns'

type BootstrapState =
  | { status: 'idle' }
  | { status: 'creating'; workspaceName: string }
  | {
      status: 'success'
      workspaceId: string
      workspaceName: string
      readUrl: string
      keys: BootstrapResponse['data']['keys']
    }
  | { status: 'error'; message: string; workspaceName: string }

export default function BootstrapPage() {
  const [workspaceName, setWorkspaceName] = useState('')
  const [state, setState] = useState<BootstrapState>({ status: 'idle' })

  const bootstrap = async () => {
    const trimmedWorkspaceName = workspaceName.trim()
    if (!trimmedWorkspaceName) return

    setState({ status: 'creating', workspaceName: trimmedWorkspaceName })

    try {
      const response = await fetch(`${getApiBaseUrl()}/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceName: trimmedWorkspaceName }),
      })

      const data = (await response.json()) as BootstrapResponse | ApiError

      if (!data.ok || !('data' in data)) {
        const errorData = data as ApiError
        setState({
          status: 'error',
          workspaceName: trimmedWorkspaceName,
          message: errorData.error?.message || 'Failed to create workspace',
        })
        return
      }

      setState({
        status: 'success',
        workspaceId: data.data.workspaceId,
        workspaceName: trimmedWorkspaceName,
        readUrl: data.data.urls.web.read,
        keys: data.data.keys,
      })
    } catch (err) {
      setState({
        status: 'error',
        workspaceName: trimmedWorkspaceName,
        message:
          err instanceof Error ? err.message : 'An unexpected error occurred',
      })
    }
  }

  const handleRetry = () => {
    setWorkspaceName(state.status === 'error' ? state.workspaceName : workspaceName)
    setState({ status: 'idle' })
  }

  const handleContinue = () => {
    if (state.status !== 'success') return

    const readUrlObj = new URL(state.readUrl)
    window.location.href = `${readUrlObj.pathname}${readUrlObj.search}${readUrlObj.hash}`
  }

  if (state.status === 'error') {
    return <BootstrapError message={state.message} onRetry={handleRetry} />
  }

  if (state.status === 'success') {
    return (
      <WorkspaceCreatedState
        workspaceName={state.workspaceName}
        keys={state.keys}
        onContinue={handleContinue}
      />
    )
  }

  if (state.status === 'creating') {
    return <BootstrapLoading state={state.status} workspaceName={state.workspaceName} />
  }

  return (
    <div className="state-shell">
      <DiagonalStripes angle={135} spacing={24} className="opacity-30" />
      <IntersectionMarks size={52} className="opacity-20" />

      <div className="state-shell-content">
        <Card className="state-shell-card w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-xl">Create Workspace</CardTitle>
            <CardDescription>
              Provide a workspace name to bootstrap new read, append, and write keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="e.g. Product Operations"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void bootstrap()
                  }
                }}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => void bootstrap()}
              disabled={!workspaceName.trim()}
            >
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


