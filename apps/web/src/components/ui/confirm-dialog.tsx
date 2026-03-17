'use client'

import { useEffect, useState } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@mdplane/ui/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmLabel,
  onConfirm,
  isLoading = false,
  destructive = false,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('')
  const isConfirmEnabled = inputValue === confirmText

  useEffect(() => {
    if (!open) {
      setInputValue('')
    }
  }, [open])

  const handleConfirm = async () => {
    if (!isConfirmEnabled || isLoading) return
    await onConfirm()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isConfirmEnabled && !isLoading) {
      handleConfirm()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-input" className="text-sm text-muted-foreground">
            {confirmLabel}
          </Label>
          <Input
            id="confirm-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={confirmText}
            className="font-mono"
            autoComplete="off"
            autoFocus
            disabled={isLoading}
          />
          {inputValue && !isConfirmEnabled ? (
            <p className="text-xs text-destructive">
              Please type &quot;{confirmText}&quot; exactly.
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isLoading}
          >
            {isLoading ? <Spinner size="sm" label="Processing..." /> : null}
            Confirm
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

