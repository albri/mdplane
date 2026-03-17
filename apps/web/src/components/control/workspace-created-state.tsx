'use client'

import { useState } from 'react'
import { Button } from '@mdplane/ui/ui/button'
import { KeyReveal } from '@/components/ui/key-reveal'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react'

interface WorkspaceCreatedStateProps {
  workspaceName: string
  keys: {
    read: string
    append: string
    write: string
  }
  onContinue: () => void
}

export function WorkspaceCreatedState({
  workspaceName,
  keys,
  onContinue,
}: WorkspaceCreatedStateProps) {
  const [keysSaved, setKeysSaved] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl border border-border bg-card p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-sage/30 bg-sage/10">
            <CheckCircle className="h-5 w-5 text-sage" />
          </div>
          <div>
            <h2 className="text-lg font-medium">Workspace created</h2>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="border border-amber/30 bg-amber/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              Store these keys now
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Root capability keys are shown once during bootstrap and after rotation.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Read key</label>
            <KeyReveal value={keys.read} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Append key</label>
            <KeyReveal value={keys.append} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Write key</label>
            <KeyReveal value={keys.write} />
          </div>

          <div className="border border-border bg-muted/40 p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="keys-saved-confirmation"
                checked={keysSaved}
                onCheckedChange={(checked) => setKeysSaved(checked === true)}
              />
              <Label htmlFor="keys-saved-confirmation" className="text-sm leading-5">
                I have saved these keys securely and understand they will not be shown again.
              </Label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Button
              onClick={onContinue}
              data-testid="continue-to-workspace"
              className="w-full sm:w-auto"
              disabled={!keysSaved}
            >
              Open Runtime Read URL
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
