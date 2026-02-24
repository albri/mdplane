'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getModifierSymbol } from '@/hooks'

interface ShortcutItem {
  keys: string[]  // e.g., ['⌘', '/']
  description: string
  category: string
}

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * All available keyboard shortcuts.
 * ⌘ is replaced with platform-specific modifier at runtime.
 */
const SHORTCUTS: ShortcutItem[] = [
  // Navigation
  { keys: ['↑', '↓'], description: 'Navigate files', category: 'Navigation' },
  { keys: ['Enter'], description: 'Open selected file', category: 'Navigation' },
  { keys: ['Escape'], description: 'Close / Deselect', category: 'Navigation' },
  
  // Actions
  { keys: ['⌘', 'C'], description: 'Copy file content', category: 'Actions' },
  { keys: ['⌘', 'K'], description: 'Open command palette', category: 'Actions' },
  
  // Help
  { keys: ['⌘', '/'], description: 'Show this dialog', category: 'Help' },
]

/**
 * Dialog that displays all available keyboard shortcuts.
 * Shows platform-specific modifier (⌘ on Mac, Ctrl on Windows).
 */
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const mod = getModifierSymbol()
  
  // Replace ⌘ with platform-specific modifier
  const shortcuts = SHORTCUTS.map(s => ({
    ...s,
    keys: s.keys.map(k => k === '⌘' ? mod : k)
  }))

  const categories = [...new Set(shortcuts.map(s => s.category))]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="shortcuts-dialog">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-wider">
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="mb-2 font-mono text-xs uppercase text-muted-foreground">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter(s => s.category === category)
                  .map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, j) => (
                          <kbd 
                            key={j}
                            className="border bg-muted px-2 py-1 font-mono text-xs"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}


