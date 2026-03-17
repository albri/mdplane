'use client'

import { useState } from 'react'
import { Button } from '@mdplane/ui/ui/button'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'

interface KeyRevealProps {
  value: string
  className?: string
  /** Number of characters to show at end when masked */
  visibleChars?: number
}

/**
 * KeyReveal Component
 *
 * Displays a sensitive value (like an API key) with mask/reveal toggle
 * and copy functionality. Masked by default for security.
 *
 * @example
 * ```tsx
 * <KeyReveal value="ws_abc123def456xyz4" />
 * <KeyReveal value="secret" visibleChars={2} />
 * ```
 */
export function KeyReveal({
  value,
  className,
  visibleChars = 4,
}: KeyRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const maskedValue =
    value.length > visibleChars
      ? '•'.repeat(value.length - visibleChars) + value.slice(-visibleChars)
      : value

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silently fail - the icon won't change to check
    }
  }

  return (
    <div
      data-testid="key-reveal"
      className={cn(
        'flex items-center gap-2 border border-border bg-muted/50 p-2',
        className
      )}
    >
      <code className="flex-1 truncate font-mono text-sm">
        {isRevealed ? value : maskedValue}
      </code>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setIsRevealed(!isRevealed)}
        aria-label={isRevealed ? 'Hide key' : 'Reveal key'}
      >
        {isRevealed ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleCopy}
        aria-label="Copy key"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

