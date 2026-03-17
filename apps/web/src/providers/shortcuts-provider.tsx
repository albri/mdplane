'use client'

import { useState, createContext, useContext, type ReactNode } from 'react'
import { useKeyboardShortcuts } from '@/hooks'
import { ShortcutsDialog } from '@/components/ui/shortcuts-dialog'
import { ControlCommandPalette } from '@/components/control/control-command-palette'

interface ShortcutsContextValue {
  openShortcutsDialog: () => void
  openCommandPalette: () => void
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: '/',
        modifiers: ['meta'],
        action: () => setShortcutsOpen(true),
        description: 'Open shortcuts dialog'
      },
      {
        key: 'k',
        modifiers: ['meta'],
        action: () => setCommandPaletteOpen(true),
        description: 'Open command palette'
      }
    ]
  })

  return (
    <ShortcutsContext.Provider
      value={{
        openShortcutsDialog: () => setShortcutsOpen(true),
        openCommandPalette: () => setCommandPaletteOpen(true),
      }}
    >
      {children}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ControlCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </ShortcutsContext.Provider>
  )
}

export function useShortcuts() {
  const context = useContext(ShortcutsContext)
  if (!context) {
    throw new Error('useShortcuts must be used within ShortcutsProvider')
  }
  return context
}


