'use client'

import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  CornerUpRight,
  Heart,
  HeartPulse,
  MessageCircle,
  RotateCw,
  X,
  XCircle,
} from 'lucide-react'
import type { OrchestrationStatus } from '@/hooks'

export const ORCHESTRATION_STATUS_ORDER: readonly OrchestrationStatus[] = [
  'pending',
  'claimed',
  'completed',
  'stalled',
  'cancelled',
] as const

export const ORCHESTRATION_STATUS_META: Record<
  OrchestrationStatus,
  {
    label: string
    icon: LucideIcon
    iconClassName: string
    accentClassName: string
    emptyMessage: string
  }
> = {
  pending: {
    label: 'Pending',
    icon: Circle,
    iconClassName: 'text-status-pending',
    accentClassName: 'bg-status-pending/50',
    emptyMessage: 'No pending tasks.',
  },
  claimed: {
    label: 'Claimed',
    icon: CircleDot,
    iconClassName: 'text-status-claimed',
    accentClassName: 'bg-status-claimed/50',
    emptyMessage: 'No claimed tasks.',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    iconClassName: 'text-status-completed',
    accentClassName: 'bg-status-completed/50',
    emptyMessage: 'No completed tasks.',
  },
  stalled: {
    label: 'Stalled',
    icon: AlertTriangle,
    iconClassName: 'text-status-blocked',
    accentClassName: 'bg-status-blocked/50',
    emptyMessage: 'No stalled tasks.',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    iconClassName: 'text-muted-foreground',
    accentClassName: 'bg-muted-foreground/40',
    emptyMessage: 'No cancelled tasks.',
  },
}

export const ORCHESTRATION_PRIORITY_META = {
  critical: { label: 'Critical', dotClassName: 'bg-red-500' },
  high: { label: 'High', dotClassName: 'bg-orange-500' },
  medium: { label: 'Medium', dotClassName: 'bg-blue-500' },
  low: { label: 'Low', dotClassName: 'bg-slate-500' },
} as const

export const APPEND_TYPE_META: Record<
  string,
  { icon: LucideIcon; label: string; iconClassName: string; accentClassName: string }
> = {
  task: { icon: Circle, label: 'Task', iconClassName: 'text-status-pending', accentClassName: 'bg-status-pending/50' },
  claim: { icon: CircleDot, label: 'Claim', iconClassName: 'text-status-claimed', accentClassName: 'bg-status-claimed/50' },
  response: {
    icon: CheckCircle2,
    label: 'Response',
    iconClassName: 'text-status-completed',
    accentClassName: 'bg-status-completed/50',
  },
  comment: {
    icon: MessageCircle,
    label: 'Comment',
    iconClassName: 'text-muted-foreground',
    accentClassName: 'bg-muted-foreground/40',
  },
  blocked: {
    icon: AlertTriangle,
    label: 'Blocked',
    iconClassName: 'text-status-blocked',
    accentClassName: 'bg-status-blocked/50',
  },
  answer: {
    icon: CornerUpRight,
    label: 'Answer',
    iconClassName: 'text-purple-500',
    accentClassName: 'bg-purple-500/50',
  },
  renew: {
    icon: RotateCw,
    label: 'Renew',
    iconClassName: 'text-orange-500',
    accentClassName: 'bg-orange-500/50',
  },
  cancel: {
    icon: X,
    label: 'Cancelled',
    iconClassName: 'text-muted-foreground',
    accentClassName: 'bg-muted-foreground/40',
  },
  vote: { icon: Heart, label: 'Vote', iconClassName: 'text-pink-500', accentClassName: 'bg-pink-500/50' },
  heartbeat: {
    icon: HeartPulse,
    label: 'Heartbeat',
    iconClassName: 'text-status-completed',
    accentClassName: 'bg-status-completed/50',
  },
} as const

export const APPEND_STATUS_BADGE_META = {
  pending: { label: 'Pending', dotClassName: 'bg-status-pending' },
  open: { label: 'Open', dotClassName: 'bg-status-pending' },
  claimed: { label: 'Claimed', dotClassName: 'bg-status-claimed' },
  active: { label: 'Active', dotClassName: 'bg-status-claimed' },
  completed: { label: 'Completed', dotClassName: 'bg-status-completed' },
  done: { label: 'Done', dotClassName: 'bg-status-completed' },
  stalled: { label: 'Stalled', dotClassName: 'bg-status-blocked' },
  blocked: { label: 'Blocked', dotClassName: 'bg-status-blocked' },
  expired: { label: 'Expired', dotClassName: 'bg-status-blocked' },
  cancelled: { label: 'Cancelled', dotClassName: 'bg-muted-foreground/60' },
} as const
