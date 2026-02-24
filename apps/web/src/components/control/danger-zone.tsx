'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@mdplane/ui/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { KeyReveal } from '@/components/ui/key-reveal'
import { useWorkspaces } from '@/contexts/workspace-context'
import { useToast } from '@/hooks'
import { useRotateAllUrls, useDeleteWorkspace } from '@/hooks/use-workspace'
import type { RotateAllResponse } from '@mdplane/shared'
import { CONTROL_FRONTEND_ROUTES } from '@mdplane/shared'

export function DangerZone() {
  const { selectedWorkspace } = useWorkspaces()
  const router = useRouter()

  const rotateUrlsMutation = useRotateAllUrls(selectedWorkspace?.id ?? null)
  const deleteWorkspaceMutation = useDeleteWorkspace(selectedWorkspace?.id ?? null)
  const toast = useToast()

  const [rotateDialogOpen, setRotateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [rotateError, setRotateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [rotateResult, setRotateResult] = useState<RotateAllResponse['data'] | null>(null)

  const handleRotateUrls = async () => {
    setRotateError(null)
    try {
      const result = await rotateUrlsMutation.mutateAsync()
      setRotateResult(result)
      toast.success({
        title: 'Keys rotated',
        description: 'Previous workspace keys are no longer valid.',
      })
      setRotateDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rotate URLs'
      setRotateError(message)
      toast.error({
        title: 'Rotation failed',
        description: message,
      })
    }
  }

  const handleDeleteWorkspace = async () => {
    setDeleteError(null)
    try {
      await deleteWorkspaceMutation.mutateAsync()
      toast.success({
        title: 'Workspace deleted',
        description: 'The workspace and its files were removed.',
      })
      router.push(CONTROL_FRONTEND_ROUTES.root)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete workspace'
      setDeleteError(message)
      toast.error({
        title: 'Delete failed',
        description: message,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Rotate capability keys
        </div>
        <p className="text-sm text-muted-foreground">
          Generate new read, append, and write keys. Existing keys stop working
          immediately.
        </p>
        {rotateError && (
          <p className="text-sm text-destructive">{rotateError}</p>
        )}
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10"
          onClick={() => {
            setRotateError(null)
            setRotateResult(null)
            setRotateDialogOpen(true)
          }}
          disabled={!selectedWorkspace}
        >
          <RefreshCw className="h-4 w-4" />
          Rotate Keys
        </Button>
      </div>

      {rotateResult ? (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4" data-testid="rotated-keys-panel">
          <p className="text-sm font-medium">New keys issued</p>
          <p className="text-xs text-muted-foreground">
            {rotateResult.keyCustodyWarning}
          </p>

          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">Read key</p>
              <KeyReveal value={rotateResult.keys.read} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Append key</p>
              <KeyReveal value={rotateResult.keys.append} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Write key</p>
              <KeyReveal value={rotateResult.keys.write} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-dashed border-border" />

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Delete workspace
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete this workspace and all its files.
        </p>
        {deleteError && (
          <p className="text-sm text-destructive">{deleteError}</p>
        )}
        <Button
          variant="destructive"
          onClick={() => {
            setDeleteError(null)
            setDeleteDialogOpen(true)
          }}
          disabled={!selectedWorkspace}
        >
          <Trash2 className="h-4 w-4" />
          Delete workspace
        </Button>
      </div>

      <ConfirmDialog
        open={rotateDialogOpen}
        onOpenChange={setRotateDialogOpen}
        title="Rotate capability keys?"
        description="This will generate new keys. Anyone using the old keys will lose access immediately."
        confirmText="rotate"
        confirmLabel="Type 'rotate' to confirm"
        onConfirm={handleRotateUrls}
        isLoading={rotateUrlsMutation.isPending}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this workspace?"
        description={`This will permanently delete "${selectedWorkspace?.name ?? 'this workspace'}" and all its files.`}
        confirmText={selectedWorkspace?.name ?? 'delete'}
        confirmLabel="Type workspace name to confirm"
        onConfirm={handleDeleteWorkspace}
        isLoading={deleteWorkspaceMutation.isPending}
        destructive
      />
    </div>
  )
}


