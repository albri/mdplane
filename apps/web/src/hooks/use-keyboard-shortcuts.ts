'use client'

import { useEffect, useCallback } from 'react'

type Modifier = 'meta' | 'ctrl' | 'alt' | 'shift'

export interface Shortcut {
  key: string
  modifiers?: Modifier[]
  action: () => void
  description: string
  disabled?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: Shortcut[]
  enabled?: boolean
}

/**
 * Hook for registering and handling keyboard shortcuts.
 * 
 * Features:
 * - Cross-platform: Cmd on Mac, Ctrl on Windows (interchangeable)
 * - Disabled when typing in inputs/textareas
 * - Individual shortcuts can be disabled
 * 
 * @example
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     {
 *       key: '/',
 *       modifiers: ['meta'],
 *       action: () => setShortcutsOpen(true),
 *       description: 'Open shortcuts'
 *     }
 *   ]
 * })
 */
export function useKeyboardShortcuts({ 
  shortcuts, 
  enabled = true 
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    for (const shortcut of shortcuts) {
      if (shortcut.disabled) continue

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const modifiers = shortcut.modifiers ?? []

      const metaRequired = modifiers.includes('meta')
      const ctrlRequired = modifiers.includes('ctrl')
      const altRequired = modifiers.includes('alt')
      const shiftRequired = modifiers.includes('shift')

      const cmdOrCtrl = metaRequired || ctrlRequired
      const cmdOrCtrlPressed = event.metaKey || event.ctrlKey

      const noModifiersRequired = !cmdOrCtrl && !altRequired && !shiftRequired
      const noModifiersPressed = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
      
      const modifiersMatch = noModifiersRequired
        ? noModifiersPressed
        : (
            (!cmdOrCtrl || cmdOrCtrlPressed) &&
            (!altRequired || event.altKey) &&
            (!shiftRequired || event.shiftKey)
          )

      if (keyMatch && modifiersMatch) {
        event.preventDefault()
        shortcut.action()
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    if (!enabled) return
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}

/**
 * Helper for getting platform-specific modifier display.
 * Returns ⌘ on Mac, Ctrl on Windows/Linux.
 */
export function getModifierSymbol(): string {
  if (typeof window === 'undefined') return '⌘'
  return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'
}

/**
 * Helper for getting platform-specific modifier key name.
 * Returns 'meta' on Mac, 'ctrl' on Windows/Linux.
 */
export function getModifierKey(): 'meta' | 'ctrl' {
  if (typeof window === 'undefined') return 'meta'
  return navigator.platform.includes('Mac') ? 'meta' : 'ctrl'
}

