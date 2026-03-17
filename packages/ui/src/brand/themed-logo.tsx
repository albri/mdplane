'use client'

import { useEffect, useState } from 'react'
import { Logo, LogoMark, type LogoSize, type LogoVariant } from './logo'

interface ThemedLogoProps {
  size?: LogoSize
  variant?: LogoVariant
  className?: string
  showWordmark?: boolean
}

function resolveDarkMode(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return true
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  return false
}

function useAutoVariant(explicitVariant?: LogoVariant): LogoVariant {
  const [variant, setVariant] = useState<LogoVariant>(explicitVariant ?? 'default')

  useEffect(() => {
    if (explicitVariant != null) {
      setVariant(explicitVariant)
      return
    }

    const update = () => {
      setVariant(resolveDarkMode() ? 'inverted' : 'default')
    }

    update()

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', update)

      const observer = typeof MutationObserver !== 'undefined'
        ? new MutationObserver(update)
        : null

      observer?.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })

      return () => {
        mediaQuery.removeEventListener('change', update)
        observer?.disconnect()
      }
    }

    return
  }, [explicitVariant])

  return explicitVariant ?? variant
}

export function ThemedLogo({
  size = 'md',
  variant,
  className,
  showWordmark = true,
}: ThemedLogoProps) {
  const resolvedVariant = useAutoVariant(variant)

  return (
    <Logo
      size={size}
      variant={resolvedVariant}
      showWordmark={showWordmark}
      {...(className != null ? { className } : {})}
    />
  )
}

export function ThemedLogoMark({
  size = 'md',
  variant,
  className,
}: Pick<ThemedLogoProps, 'size' | 'variant' | 'className'>) {
  const resolvedVariant = useAutoVariant(variant)

  return (
    <LogoMark
      size={size}
      variant={resolvedVariant}
      {...(className != null ? { className } : {})}
    />
  )
}
