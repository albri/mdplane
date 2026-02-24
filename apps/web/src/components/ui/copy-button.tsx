'use client'

import { useState } from 'react'
import { Button } from '@mdplane/ui/ui/button'
import { Copy, Check } from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function CopyButton({
  text,
  label = 'Copy',
  className,
  variant = 'outline',
  size = 'default',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(className)}
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </Button>
  )
}


