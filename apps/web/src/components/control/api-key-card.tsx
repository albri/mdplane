'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@mdplane/ui/ui/button'
import { Key, Copy, Trash2, Check, Clock } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'
import type { ApiKey } from '@/hooks'

interface ApiKeyCardProps {
  apiKey: ApiKey
  onDelete?: (keyId: string) => void
  isDeleting?: boolean
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ApiKeyCard({ apiKey, onDelete, isDeleting }: ApiKeyCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey.prefix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()

  return (
    <Card tone="interactive" size="sm" className={cn(isExpired && 'opacity-60')}>
      <CardHeader className="gap-0 pb-2">
        <div className="flex min-w-0 items-start gap-0">
          <Key className="mt-0.5 mr-2 h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-medium" title={apiKey.name}>
              {apiKey.name}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Created: {formatDate(apiKey.createdAt)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {isExpired ? (
              <Badge variant="expired" className="text-[10px] uppercase tracking-wide">
                Expired
              </Badge>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete?.(apiKey.id)}
              disabled={isDeleting}
              aria-label="Delete API key"
              data-testid="delete-api-key-btn"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 rounded-md border border-border/70 bg-muted/35 px-2 py-1 font-mono text-xs">
            <span className="block truncate">{apiKey.prefix}</span>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 shrink-0"
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy API key'}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {apiKey.permissions.map((permission) => (
            <Badge key={permission} variant="outline" className="font-mono text-xs">
              {permission}
            </Badge>
          ))}
        </div>

        <div className="grid gap-1.5 text-xs text-muted-foreground">
          {apiKey.expiresAt && (
            <div className={cn(
              'flex items-center gap-1.5',
              isExpired && 'text-destructive'
            )}>
              <Clock className="h-3 w-3" />
              <span>{isExpired ? 'Expired' : 'Expires'}: {formatDate(apiKey.expiresAt)}</span>
            </div>
          )}

          {apiKey.lastUsedAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Last used: {formatDate(apiKey.lastUsedAt)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


