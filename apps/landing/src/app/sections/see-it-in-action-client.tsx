'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Code2, FileText, Globe, Key, Zap } from 'lucide-react'
import { URLS } from '@mdplane/shared'
import { cn } from '@mdplane/ui/lib/utils'
import { Button } from '@mdplane/ui/ui/button'
import { CodeBlock } from '@mdplane/ui/ui/code-block'

import type { StoryStep } from './see-it-in-action-data'

type SeeItInActionClientProps = {
  steps: StoryStep[]
}

export function SeeItInActionClient({ steps }: SeeItInActionClientProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showCode, setShowCode] = useState(true)
  const [codeTab, setCodeTab] = useState<'request' | 'response'>('request')

  const step = steps[currentStep]
  if (!step) return null

  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const goToStep = (index: number) => {
    setCurrentStep(Math.max(0, Math.min(steps.length - 1, index)))
    setCodeTab('request')
  }

  return (
    <div className="mt-8">
      {/* Step indicators */}
      <div className="mb-6 flex items-center justify-center gap-1.5" role="tablist" aria-label="Story steps">
        {steps.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === currentStep}
            onClick={() => goToStep(i)}
            className={cn(
              'relative flex size-8 items-center justify-center rounded-full transition-all duration-300',
              i === currentStep
                ? 'bg-primary text-primary-foreground'
                : i < currentStep
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            aria-label={`Step ${i + 1}: ${s.title}`}
          >
            {i < currentStep ? (
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            ) : (
              <span className="font-mono text-xs font-semibold" aria-hidden="true">{i + 1}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main content card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        {/* Step header */}
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-4 sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </p>
            <h3 className="text-base font-semibold text-foreground sm:text-lg">{step.title}</h3>
          </div>
        </div>

        {/* Story section */}
        <div className="border-b border-border bg-background px-4 py-4 sm:px-6">
          <p className="text-sm leading-relaxed text-foreground/90 sm:text-base">{step.story}</p>
        </div>

        {/* Visual section */}
        <div className="bg-background p-4 sm:p-6">
          {step.visual.kind === 'keys' && <KeysVisual />}
          {step.visual.kind === 'watcher' && <WatcherVisual />}
          {step.visual.kind === 'browser' && <BrowserVisual />}
          {step.visual.kind === 'document' && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-2.5 text-xs">
                <FileText className="size-3.5 text-primary" aria-hidden="true" />
                <span className="font-mono font-medium text-foreground">pr-reviews.md</span>
              </div>
              <div className="p-4 sm:p-5">
                <DocumentPreview
                  content={step.visual.content}
                  highlightLines={step.visual.highlightLines}
                />
              </div>
            </div>
          )}
        </div>

        {/* Code section */}
        {step.code && (
          <div className="border-t border-border bg-background">
            <button
              onClick={() => setShowCode(!showCode)}
              aria-expanded={showCode}
              aria-controls={`code-panel-${step.id}`}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30 sm:px-6"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Code2 className="size-3.5" aria-hidden="true" />
                <span className="font-medium">Code</span>
              </div>
              <span className="text-xs font-medium text-primary">
                {showCode ? 'Hide' : 'Show'}
              </span>
            </button>
            {showCode && (
              <div id={`code-panel-${step.id}`} className="px-4 pb-4 sm:px-6">
                {/* Tabs */}
                <div className="mb-2 flex gap-1" role="tablist" aria-label="Code example">
                  <button
                    role="tab"
                    aria-selected={codeTab === 'request'}
                    aria-controls={`code-content-${step.id}`}
                    onClick={() => setCodeTab('request')}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      codeTab === 'request'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Request
                  </button>
                  <button
                    role="tab"
                    aria-selected={codeTab === 'response'}
                    aria-controls={`code-content-${step.id}`}
                    onClick={() => setCodeTab('response')}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      codeTab === 'response'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Response
                  </button>
                </div>
                <div id={`code-content-${step.id}`} role="tabpanel">
                  <CodeBlock
                    code={codeTab === 'request' ? step.code.request : step.code.response}
                    language={codeTab === 'response' ? 'json' : (step.code.language ?? 'bash')}
                    className="my-0 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation footer */}
        <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToStep(currentStep - 1)}
            disabled={isFirst}
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-2" aria-hidden="true">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === currentStep ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={() => goToStep(currentStep + 1)}
            disabled={isLast}
          >
            <span className="hidden sm:inline">{isLast ? 'Done' : 'Next'}</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function KeysVisual() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-2.5 text-xs">
        <Key className="size-3.5 text-primary" aria-hidden="true" />
        <span className="font-medium text-foreground">Three capability URLs, three permission levels</span>
      </div>
      <div className="space-y-2 overflow-x-auto p-4 font-mono text-sm sm:p-5">
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="w-14 shrink-0 text-muted-foreground">read</span>
          <code className="rounded bg-muted px-2 py-1 text-xs">r_k7x9m2...</code>
          <span className="text-xs text-muted-foreground">→ read any file</span>
        </div>
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="w-14 shrink-0 text-primary">append</span>
          <code className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">a_p4q8n1...</code>
          <span className="text-xs text-muted-foreground">→ append to files (for agents)</span>
        </div>
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="w-14 shrink-0 text-muted-foreground">write</span>
          <code className="rounded bg-muted px-2 py-1 text-xs">w_j3f6v5...</code>
          <span className="text-xs text-muted-foreground">→ full access (for you)</span>
        </div>
      </div>
    </div>
  )
}

function WatcherVisual() {
  return (
    <div className="rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="size-4 text-amber-500" aria-hidden="true" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Your code — runs outside mdplane
        </span>
      </div>
      <p className="text-sm text-foreground/80">
        mdplane is the persistence layer. You write a watcher that:
      </p>
      <ul className="mt-2 space-y-1 text-sm text-foreground/70">
        <li className="flex items-start gap-2">
          <span className="text-amber-500">1.</span>
          Watches the file for new tasks
        </li>
        <li className="flex items-start gap-2">
          <span className="text-amber-500">2.</span>
          Spawns an agent (Claude Code, OpenCode, Codex...)
        </li>
        <li className="flex items-start gap-2">
          <span className="text-amber-500">3.</span>
          Agent has mdplane skills — knows how to read, claim, respond
        </li>
      </ul>
    </div>
  )
}

function BrowserVisual() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-2.5 text-xs">
        <Globe className="size-3.5 text-primary" aria-hidden="true" />
        <span className="font-medium text-foreground">Your workspace on the web</span>
      </div>
      <div className="space-y-3 p-4 text-sm text-foreground/80 sm:p-5">
        <p>Every workspace gets a web URL where you can:</p>
        <ul className="space-y-1 text-foreground/70">
          <li className="flex items-start gap-2">
            <span className="text-primary" aria-hidden="true">→</span>
            Browse files and folders
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary" aria-hidden="true">→</span>
            See rendered markdown
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary" aria-hidden="true">→</span>
            View task/claim/response history
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary" aria-hidden="true">→</span>
            Watch updates in real-time
          </li>
        </ul>
        <div className="pt-2">
          <a
            href={`${URLS.APP}/demo`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Globe className="size-4" aria-hidden="true" />
            See the demo workspace
          </a>
        </div>
      </div>
    </div>
  )
}

function DocumentPreview({
  content,
  highlightLines,
}: {
  content: string
  highlightLines?: number[]
}) {
  const lines = content.split('\n')

  return (
    <div className="space-y-0.5 font-mono text-sm leading-relaxed">
      {lines.map((line, i) => {
        const lineNum = i + 1
        const isHighlighted = highlightLines?.includes(lineNum)
        const isEmpty = line.trim() === ''

        if (isEmpty) {
          return <div key={i} className="h-2" />
        }

        let lineClass = '-mx-2 rounded px-2 text-foreground/80'

        if (line.startsWith('# ')) {
          lineClass = '-mx-2 px-2 text-base font-bold text-foreground'
        } else if (line.startsWith('---')) {
          lineClass = 'text-border'
        } else if (line.startsWith('**Task**')) {
          lineClass = '-mx-2 px-2 font-medium text-blue-600 dark:text-blue-400'
        } else if (line.includes('↳ claimed')) {
          lineClass = 'pl-6 text-amber-600 dark:text-amber-400'
        } else if (line.includes('✓ Done')) {
          lineClass = 'pl-6 text-green-600 dark:text-green-400'
        } else if (line.match(/^\d+\./)) {
          lineClass = '-mx-2 px-2 text-foreground/70'
        }

        return (
          <div key={i} className={cn(lineClass, isHighlighted && 'bg-primary/10')}>
            {line}
          </div>
        )
      })}
    </div>
  )
}
