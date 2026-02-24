'use client'

import { useState } from 'react'
import { Plus, AlertTriangle, Webhook } from 'lucide-react'

import {
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useToast,
  useUpdateWebhook,
  useWebhooks,
  useWorkspaceId,
} from '@/hooks'
import {
  WORKSPACE_FRONTEND_ROUTES,
  URLS,
  type WebhookEvent,
} from '@mdplane/shared'
import { ControlContent, ControlHeader, WebhookCard } from '@/components/control'
import { Button } from '@mdplane/ui/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Card, CardContent } from '@/components/ui/card'

const AVAILABLE_EVENTS: Array<{ value: WebhookEvent; label: string }> = [
  { value: 'file.created', label: 'File Created' },
  { value: 'file.updated', label: 'File Updated' },
  { value: 'file.deleted', label: 'File Deleted' },
  { value: 'task.claimed', label: 'Task Claimed' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.expired', label: 'Task Expired' },
]

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return fallback
}

export default function WebhooksPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [newWebhookEvents, setNewWebhookEvents] = useState<WebhookEvent[]>([])
  const [createFormError, setCreateFormError] = useState<string | null>(null)

  const workspaceId = useWorkspaceId()

  const toast = useToast()
  const { data: webhooks = [], isLoading, error } = useWebhooks(workspaceId)
  const errorCode = (error as Error & { code?: string } | null)?.code

  const createMutation = useCreateWebhook(workspaceId)
  const updateMutation = useUpdateWebhook(workspaceId)
  const deleteMutation = useDeleteWebhook(workspaceId)
  const testMutation = useTestWebhook(workspaceId)

  const handleCloseDialog = () => {
    setCreateDialogOpen(false)
    setCreateFormError(null)
    setNewWebhookUrl('')
    setNewWebhookEvents([])
  }

  const handleCreate = async () => {
    if (!newWebhookUrl.trim()) {
      setCreateFormError('Endpoint URL is required.')
      return
    }

    if (newWebhookEvents.length === 0) {
      setCreateFormError('Select at least one event.')
      return
    }

    try {
      await createMutation.mutateAsync({
        url: newWebhookUrl.trim(),
        events: newWebhookEvents,
      })

      toast.success({
        title: 'Webhook created',
        description: `${newWebhookEvents.length} event${newWebhookEvents.length > 1 ? 's' : ''} configured.`,
      })
      handleCloseDialog()
    } catch (mutationError) {
      setCreateFormError(getErrorMessage(mutationError, 'Failed to create webhook'))
      toast.error({
        title: 'Create failed',
        description: getErrorMessage(mutationError, 'Failed to create webhook'),
      })
    }
  }

  const toggleEvent = (event: WebhookEvent) => {
    setCreateFormError(null)
    setNewWebhookEvents((previous) =>
      previous.includes(event)
        ? previous.filter((item) => item !== event)
        : [...previous, event]
    )
  }

  const handleToggle = async (webhookId: string, status: 'active' | 'paused') => {
    try {
      await updateMutation.mutateAsync({
        webhookId,
        data: { active: status === 'active' },
      })

      toast.success({
        title: status === 'active' ? 'Webhook enabled' : 'Webhook paused',
      })
    } catch (mutationError) {
      toast.error({
        title: 'Update failed',
        description: getErrorMessage(mutationError, 'Failed to update webhook'),
      })
    }
  }

  const handleDelete = async (webhookId: string) => {
    try {
      await deleteMutation.mutateAsync(webhookId)
      toast.success({ title: 'Webhook deleted' })
    } catch (mutationError) {
      toast.error({
        title: 'Delete failed',
        description: getErrorMessage(mutationError, 'Failed to delete webhook'),
      })
    }
  }

  const handleTest = async (webhookId: string) => {
    try {
      await testMutation.mutateAsync(webhookId)
      toast.success({
        title: 'Test event sent',
        description: 'Check your endpoint logs for the webhook payload.',
      })
    } catch (mutationError) {
      toast.error({
        title: 'Test failed',
        description: getErrorMessage(mutationError, 'Failed to test webhook'),
      })
    }
  }

  return (
    <div className="flex flex-col">
      <ControlHeader
        title="Webhooks"
        description="Configure outbound events for files and tasks."
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Webhook
          </Button>
        }
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Configure an endpoint and select which events should be delivered.
            </DialogDescription>
          </DialogHeader>

          <Form
            className="space-y-4 py-2"
            onFormSubmit={async () => {
              await handleCreate()
            }}
          >
            <FormField name="url">
              <FormLabel>Endpoint URL</FormLabel>
              <FormControl
                type="url"
                value={newWebhookUrl}
                onValueChange={(value) => {
                  setCreateFormError(null)
                  setNewWebhookUrl(value)
                }}
                placeholder="https://your-server.com/webhook"
                required
              />
              <FormDescription>
                HTTPS endpoint that receives signed webhook events.
              </FormDescription>
            </FormField>

            <FormField name="events">
              <FormLabel>Events</FormLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <Card key={event.value} tone="interactive" size="sm" className="overflow-hidden">
                    <CardContent className="p-0">
                      <label className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm">
                        <Checkbox
                          checked={newWebhookEvents.includes(event.value)}
                          onCheckedChange={() => toggleEvent(event.value)}
                        />
                        <span>{event.label}</span>
                      </label>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <FormDescription>
                Choose one or more event types to receive.
              </FormDescription>
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
                  !newWebhookUrl.trim() ||
                  newWebhookEvents.length === 0
                }
              >
                {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      <ControlContent>
        {isLoading ? (
          <ItemsGridSkeleton count={4} />
        ) : error ? (
          <EmptyState
            icon={<AlertTriangle className="h-12 w-12" />}
            headline="Couldn't load webhooks"
            description={
              errorCode === 'NOT_FOUND'
                  ? 'Workspace not found. Open it from Workspace Launcher.'
                  : 'Open your workspace from Workspace Launcher and try again.'
            }
            primaryAction={{
              label: 'Workspace Launcher',
              href: WORKSPACE_FRONTEND_ROUTES.launch,
            }}
            className="rounded-none border-0 bg-transparent py-16 shadow-none"
          />
        ) : webhooks.length === 0 ? (
          <div data-testid="empty-webhooks-state">
            <EmptyState
              icon={<Webhook className="h-12 w-12" />}
              headline="No webhooks configured"
              description="Create a webhook to receive real-time workspace notifications."
              primaryAction={{ label: 'Create Webhook', onClick: () => setCreateDialogOpen(true) }}
              secondaryAction={{
                label: 'Webhook docs',
                href: `${URLS.DOCS}/docs/api-reference`,
              }}
              className="rounded-none border-0 bg-transparent py-16 shadow-none"
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {webhooks.map((webhook) => (
              <WebhookCard
                key={webhook.id}
                webhook={webhook}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onTest={handleTest}
                isToggling={updateMutation.isPending}
                isTesting={testMutation.isPending}
              />
            ))}
          </div>
        )}
      </ControlContent>
    </div>
  )
}

