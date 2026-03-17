'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { extractWriteKey } from '@/lib/extract-write-key'
import { Button } from '@mdplane/ui/ui/button'
import { KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { useState } from 'react'

interface WorkspaceClaimDialogProps {
  onNavigate?: () => void
}

export function WorkspaceClaimDialog({ onNavigate }: WorkspaceClaimDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [writeKeyInput, setWriteKeyInput] = useState('')
  const resolvedWriteKey = extractWriteKey(writeKeyInput)

  function handleContinue() {
    if (!resolvedWriteKey) return
    setOpen(false)
    setWriteKeyInput('')
    onNavigate?.()
    router.push(`/claim/${resolvedWriteKey}`)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleContinue()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        data-testid="claim-workspace-button"
        aria-label="Claim"
        title="Claim workspace"
        onClick={() => setOpen(true)}
        className="text-muted-foreground"
      >
        <KeyRound className="h-4 w-4" />
        <span>Claim</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim workspace</DialogTitle>
            <DialogDescription>
              Paste the workspace write key to continue through OAuth and bind ownership.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={writeKeyInput}
              onChange={(event) => setWriteKeyInput(event.target.value)}
              placeholder="Paste write key or /claim URL"
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!resolvedWriteKey}>
                Continue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

