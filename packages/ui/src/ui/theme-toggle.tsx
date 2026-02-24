'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { cn } from '../lib/utils'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const mode = mounted ? resolvedTheme : null

  return (
    <button
      type='button'
      data-testid='theme-toggle'
      data-theme-toggle=''
      aria-label='Toggle theme'
      onClick={() => {
        setTheme(mode === 'light' ? 'dark' : 'light')
      }}
      className={cn(
        'inline-flex items-center rounded-full border border-border p-0 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] *:rounded-full',
        className
      )}
    >
      <Sun
        fill='currentColor'
        className={cn(
          'size-6.5 p-1.5 text-muted-foreground',
          mode === 'light' ? 'bg-accent text-accent-foreground' : null
        )}
      />
      <Moon
        fill='currentColor'
        className={cn(
          'size-6.5 p-1.5 text-muted-foreground',
          mode === 'dark' ? 'bg-accent text-accent-foreground' : null
        )}
      />
    </button>
  )
}
