'use client'

import { useState, useMemo } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
} from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'
import { Button } from '@mdplane/ui/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@mdplane/ui/ui/popover'
import type { KeyType } from '@mdplane/shared'

interface LLMCopyButtonProps {
  markdownContent: string
}

export function LLMCopyButton({ markdownContent }: LLMCopyButtonProps) {
  const [checked, setChecked] = useState(false)

  const handleClick = async () => {
    await navigator.clipboard.writeText(markdownContent)
    setChecked(true)
    setTimeout(() => setChecked(false), 2000)
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={checked ? 'Copied to clipboard' : 'Copy markdown content'}
      onClick={handleClick}
      className="gap-2"
      data-testid="llm-copy-button"
    >
      {checked ? <Check className="size-3.5 text-muted-foreground" /> : <Copy className="size-3.5 text-muted-foreground" />}
      Copy Markdown
    </Button>
  )
}

interface CapabilityBadgeProps {
  keyType: KeyType
  className?: string
}

/**
 * Badge showing capability access level (read-only/full-access/append-only)
 */
export function CapabilityBadge({ keyType, className }: CapabilityBadgeProps) {
  const config = {
    r: {
      label: 'Read-Only',
      description: 'Can read files and folders, but cannot change content.',
      icon: Eye,
    },
    w: {
      label: 'Full Access',
      description: 'Can read, create, update, and delete files and folders.',
      icon: Pencil,
    },
    a: {
      label: 'Append-Only',
      description: 'Can append task/comments metadata, but cannot edit file bodies.',
      icon: Plus,
    },
  }

  const { label, description, icon: Icon } = config[keyType]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-foreground',
            className
          )}
          aria-label={`Access level: ${label} - ${description}`}
          data-testid="capability-access-badge"
        >
          <Icon className="size-3 text-muted-foreground" aria-hidden="true" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  )
}

interface ViewOptionsProps {
  markdownUrl: string
}

/**
 * Dropdown with options to open content in various AI tools
 */
export function ViewOptions({ markdownUrl }: ViewOptionsProps) {
  const items = useMemo(() => {
    const fullUrl =
      typeof window !== 'undefined'
        ? new URL(markdownUrl, window.location.origin).toString()
        : markdownUrl
    const q = `Read ${fullUrl}, I want to ask questions about it.`

    return [
      {
        title: 'Open in ChatGPT',
        href: `https://chatgpt.com/?${new URLSearchParams({ hints: 'search', q })}`,
      },
      {
        title: 'Open in Claude',
        href: `https://claude.ai/new?${new URLSearchParams({ q })}`,
      },
      {
        title: 'Open in Scira AI',
        href: `https://scira.ai/?${new URLSearchParams({ q })}`,
      },
    ]
  }, [markdownUrl])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          Open
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-48 flex-col p-1">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            rel="noreferrer noopener"
            target="_blank"
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            {item.title}
            <ExternalLink className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
          </a>
        ))}
      </PopoverContent>
    </Popover>
  )
}


