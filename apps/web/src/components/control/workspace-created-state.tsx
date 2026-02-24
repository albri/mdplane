'use client'

import { useState } from 'react'
import { Button } from '@mdplane/ui/ui/button'
import { BorderedIcon } from '@mdplane/ui/ui/bordered-icon'
import { KeyReveal } from '@/components/ui/key-reveal'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react'
import { DiagonalStripes, IntersectionMarks } from '@/components/ui/patterns'

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
    <div className="state-shell">
      <DiagonalStripes angle={135} spacing={24} className="opacity-30" />
      <IntersectionMarks size={52} className="opacity-20" />

      <div className="state-shell-content">
        <div className="state-shell-card w-full max-w-xl p-8">
          <div className="mb-6 flex items-center gap-3">
            <BorderedIcon variant="success">
              <CheckCircle className="h-6 w-6" />
            </BorderedIcon>
            <div>
              <h2 className="text-lg font-medium">Workspace created</h2>
              <p className="text-sm text-muted-foreground">{workspaceName}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
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

            <div className="rounded-md border border-border/70 bg-muted/40 p-3">
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
    </div>
  )
}
