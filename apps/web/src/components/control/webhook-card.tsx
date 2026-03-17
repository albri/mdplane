'use client'

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@mdplane/ui/ui/button'
import { Switch } from '@/components/ui/switch'
import { Webhook, Trash2, FlaskConical, ExternalLink, Clock } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'
import type { Webhook as WebhookType } from '@/hooks'

interface WebhookCardProps {
  webhook: WebhookType
  onToggle?: (webhookId: string, status: 'active' | 'paused') => void
  onDelete?: (webhookId: string) => void
  onTest?: (webhookId: string) => void
  isToggling?: boolean
  isTesting?: boolean
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getWebhookDisplay(url: string): { host: string; path: string } {
  try {
    const parsed = new URL(url)
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`
    return {
      host: parsed.host,
      path: path && path !== '/' ? path : '',
    }
  } catch {
    return {
      host: url,
      path: '',
    }
  }
}

export function WebhookCard({ webhook, onToggle, onDelete, onTest, isToggling, isTesting }: WebhookCardProps) {
  const isActive = webhook.status === 'active'
  const display = getWebhookDisplay(webhook.url)

  return (
    <Card tone="interactive" size="sm">
      <CardHeader className="gap-0 pb-2">
        <div className="flex min-w-0 items-start gap-0">
          <Webhook className="mt-0.5 mr-2 h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-medium" title={`${display.host}${display.path}`}>
              {display.host}
              {display.path}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Created: {formatDate(webhook.createdAt)}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon-sm" asChild aria-label="Open webhook endpoint">
            <a href={webhook.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          {webhook.events.map((event) => (
            <Badge key={event} variant="outline" className="font-mono text-xs">
              {event}
            </Badge>
          ))}
        </div>

        <div className="grid gap-1.5 text-xs text-muted-foreground">
          {webhook.successRate !== undefined && (
            <div className={cn(
              'flex items-center gap-1.5',
              webhook.successRate >= 0.9 ? 'text-green-600' :
              webhook.successRate >= 0.7 ? 'text-yellow-600' : 'text-destructive'
            )}>
              <FlaskConical className="h-3 w-3" />
              Success rate: {Math.round(webhook.successRate * 100)}%
            </div>
          )}

          {webhook.lastTriggeredAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Last triggered: {formatDate(webhook.lastTriggeredAt)}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="mt-auto border-t border-border/70 pt-4">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => onToggle?.(webhook.id, checked ? 'active' : 'paused')}
              disabled={isToggling}
              aria-label={isActive ? 'Pause webhook' : 'Activate webhook'}
            />
            <span className="text-xs text-muted-foreground">Enabled</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTest?.(webhook.id)}
              disabled={isTesting}
              aria-label="Test webhook"
              className="h-8 px-2.5 text-xs"
            >
              <FlaskConical className={cn('h-3.5 w-3.5', isTesting && 'animate-pulse')} />
              Test
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete?.(webhook.id)}
              aria-label="Delete webhook"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}


