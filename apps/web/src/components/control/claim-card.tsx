'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@mdplane/ui/ui/button'
import { Clock, RefreshCw, CheckCircle, XCircle, AlertTriangle, FileText, CircleDot, Ban, X, type LucideIcon } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'
import type { ControlClaim } from '@/hooks'

interface ClaimCardProps {
  claim: ControlClaim
  onRenew?: (claimId: string) => void
  onComplete?: (claimId: string) => void
  onCancel?: (claimId: string) => void
  onBlock?: (claimId: string) => void
  isRenewing?: boolean
}

const statusConfig: Record<ControlClaim['status'], { label: string; icon: LucideIcon; variant: 'claimed' | 'expired' | 'completed' | 'blocked'; ariaLabel: string }> = {
  active: {
    label: 'In Progress',
    icon: CircleDot,
    variant: 'claimed',
    ariaLabel: 'Task in progress'
  },
  expired: {
    label: 'Expired',
    icon: Ban,
    variant: 'expired',
    ariaLabel: 'Task expired'
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    variant: 'completed',
    ariaLabel: 'Task completed'
  },
  cancelled: {
    label: 'Cancelled',
    icon: X,
    variant: 'expired',
    ariaLabel: 'Task cancelled'
  },
  blocked: {
    label: 'Blocked',
    icon: AlertTriangle,
    variant: 'blocked',
    ariaLabel: 'Task is blocked'
  },
}

function getTimeRemaining(expiresAt: string): string {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diff = expires.getTime() - now.getTime()
  
  if (diff <= 0) return 'Expired'
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m left`
  return `${minutes}m left`
}

export function ClaimCard({ claim, onRenew, onComplete, onCancel, onBlock, isRenewing }: ClaimCardProps) {
  const status = statusConfig[claim.status]
  const StatusIcon = status.icon
  const timeRemaining = claim.status === 'active' ? getTimeRemaining(claim.expiresAt) : null

  return (
    <Card tone="interactive" size="sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-1">
        <div className="flex-1 space-y-1">
          <CardTitle className="text-base font-medium leading-tight">
            {claim.taskTitle}
          </CardTitle>
          <CardDescription className="flex items-center gap-2 text-sm">
            <FileText className="h-3 w-3" />
            <span className="break-all font-mono text-xs">{claim.path}</span>
          </CardDescription>
        </div>
        <Badge
          variant={status.variant}
          className="shrink-0"
          aria-label={status.ariaLabel}
        >
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{status.label}</span>
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-3 pt-1">
        {timeRemaining && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              'font-mono',
              timeRemaining.includes('Expired') ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {timeRemaining}
            </span>
          </div>
        )}
        
        {claim.status === 'active' && (
          <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onRenew?.(claim.id)}
              disabled={isRenewing}
            >
              <RefreshCw className={cn('h-3 w-3', isRenewing && 'animate-spin')} />
              Renew
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onComplete?.(claim.id)}
            >
              <CheckCircle className="h-3 w-3" />
              Complete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => onBlock?.(claim.id)}
            >
              <AlertTriangle className="h-3 w-3" />
              Block
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-destructive hover:text-destructive sm:w-auto"
              onClick={() => onCancel?.(claim.id)}
            >
              <XCircle className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        )}
        
        {claim.blockedReason && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs">
            <span className="font-medium">Blocked:</span> {claim.blockedReason}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


