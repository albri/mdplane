'use client'

import { useState } from 'react'
import { Check, Copy, Key, Plus, AlertTriangle } from 'lucide-react'

import {
  type ApiKey,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  useToast,
  useWorkspaceId,
} from '@/hooks'
import { WORKSPACE_FRONTEND_ROUTES } from '@mdplane/shared'
import { ApiKeyCard, ControlContent, ControlHeader } from '@/components/control'
import { Button } from '@mdplane/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from '@/components/ui/form'
import { ItemsGridSkeleton } from '@/components/ui/skeletons'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'

type ApiKeyPermission = 'read' | 'append' | 'write' | 'export'

const AVAILABLE_PERMISSIONS = [
  { value: 'read' as const, label: 'Read - View files and folders' },
  { value: 'append' as const, label: 'Append - Add content to files' },
  { value: 'write' as const, label: 'Write - Full file access' },
  { value: 'export' as const, label: 'Export - Export workspace data' },
]

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return fallback
}

export default function ApiKeysPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPermissions, setNewKeyPermissions] = useState<ApiKeyPermission[]>(['read'])
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [createFormError, setCreateFormError] = useState<string | null>(null)

  const workspaceId = useWorkspaceId()

  const toast = useToast()
  const { data: apiKeys = [], isLoading, error } = useApiKeys(workspaceId)
  const createMutation = useCreateApiKey(workspaceId)
  const deleteMutation = useDeleteApiKey(workspaceId)

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      setCreateFormError('Name is required.')
      return
    }

    if (newKeyPermissions.length === 0) {
      setCreateFormError('Select at least one permission.')
      return
    }

    try {
      const result = await createMutation.mutateAsync({
        name: newKeyName.trim(),
        permissions: newKeyPermissions,
      })

      if (result?.key) {
        setCreatedKey(result.key)
      }

      toast.success({
        title: 'API key created',
        description: 'Copy the key now. It will not be shown again.',
      })
    } catch (mutationError) {
      const message = getErrorMessage(mutationError, 'Failed to create API key')
      setCreateFormError(message)
      toast.error({
        title: 'Create failed',
        description: message,
      })
    }
  }

  const handleCopyKey = async () => {
    if (!createdKey) return

    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    toast.success({
      title: 'Copied',
      description: 'API key copied to clipboard.',
      timeout: 2000,
    })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseDialog = () => {
    setCreateDialogOpen(false)
    setNewKeyName('')
    setNewKeyPermissions(['read'])
    setCreatedKey(null)
    setCopied(false)
    setCreateFormError(null)
  }

  const togglePermission = (permission: ApiKeyPermission) => {
    setCreateFormError(null)
    setNewKeyPermissions((previous) =>
      previous.includes(permission)
        ? previous.filter((item) => item !== permission)
        : [...previous, permission]
    )
  }

  const handleDelete = async (apiKeyId: string) => {
    try {
      await deleteMutation.mutateAsync(apiKeyId)
      toast.success({ title: 'API key revoked' })
    } catch (mutationError) {
      toast.error({
        title: 'Revoke failed',
        description: getErrorMessage(mutationError, 'Failed to revoke API key'),
      })
    }
  }

  return (
    <div className="flex flex-col">
      <ControlHeader
        title="API Keys"
        description="Manage API keys for programmatic access"
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create API Key
          </Button>
        }
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          {createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle>API Key Created</DialogTitle>
                <DialogDescription>
                  Copy your API key now. You won&apos;t be able to see it again.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background p-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-sm">{createdKey}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyKey}
                    aria-label={copied ? 'Copied to clipboard' : 'Copy API key'}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={handleCloseDialog}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>
                  Create a new API key for programmatic access to your workspace.
                </DialogDescription>
              </DialogHeader>

              <Form
                className="space-y-4 py-2"
                onFormSubmit={async () => {
                  await handleCreate()
                }}
              >
                <FormField name="name">
                  <FormLabel>Name</FormLabel>
                  <FormControl
                    value={newKeyName}
                    onValueChange={(value) => {
                      setCreateFormError(null)
                      setNewKeyName(value)
                    }}
                    placeholder="e.g., CI/CD Pipeline"
                    required
                  />
                  <FormDescription>Use a descriptive name for auditing.</FormDescription>
                </FormField>

                <FormField name="permissions">
                  <FormLabel>Permissions</FormLabel>
                  <div className="space-y-2">
                    {AVAILABLE_PERMISSIONS.map((permission) => (
                      <Card key={permission.value} tone="interactive" size="sm" className="overflow-hidden">
                        <CardContent className="p-0">
                          <label className="flex cursor-pointer items-center gap-2 p-2.5 text-sm">
                            <Checkbox
                              checked={newKeyPermissions.includes(permission.value)}
                              onCheckedChange={() => togglePermission(permission.value)}
                            />
                            <span>{permission.label}</span>
                          </label>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <FormDescription>Select least privilege required for this key.</FormDescription>
                </FormField>

                {createFormError ? (
                  <p className="text-sm text-destructive">{createFormError}</p>
                ) : null}

                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending ||
                      !newKeyName.trim() ||
                      newKeyPermissions.length === 0
                    }
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ControlContent>
        {isLoading ? (
          <ItemsGridSkeleton count={4} />
        ) : error ? (
          <EmptyState
            icon={<AlertTriangle className="h-12 w-12" />}
            headline="Couldn't load API keys"
            description="Open your workspace from Workspace Launcher and try again."
            primaryAction={{
              label: 'Workspace Launcher',
              href: WORKSPACE_FRONTEND_ROUTES.launch,
            }}
            secondaryAction={{
              label: 'Create workspace',
              href: '/bootstrap',
            }}
            className="rounded-none border-0 bg-transparent py-16 shadow-none"
          />
        ) : apiKeys.length === 0 ? (
          <div data-testid="empty-api-keys-state">
            <EmptyState
              icon={<Key className="h-12 w-12" />}
              headline="No API keys yet"
              description="Create your first API key for programmatic workspace access."
              primaryAction={{ label: 'Create API Key', onClick: () => setCreateDialogOpen(true) }}
              secondaryAction={{ label: 'Workspace Launcher', href: WORKSPACE_FRONTEND_ROUTES.launch }}
              className="rounded-none border-0 bg-transparent py-16 shadow-none"
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2" data-testid="api-keys-list">
            {apiKeys.map((apiKey: ApiKey) => (
              <ApiKeyCard
                key={apiKey.id}
                apiKey={apiKey}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </ControlContent>
    </div>
  )
}

