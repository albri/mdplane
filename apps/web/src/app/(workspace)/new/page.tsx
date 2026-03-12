'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Check, Copy, AlertCircle, X } from 'lucide-react'
import { Logo } from '@mdplane/ui'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Step = 'input' | 'creating' | 'done'

interface CreatedWorkspace {
  readKey: string
  writeKey: string
}

interface FileEntry {
  name: string
  content: string
}

function generateWorkspaceName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `workspace-${id}`
}

const MAX_FILES = 25

function isValidFile(file: File): boolean {
  return file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type === 'text/markdown' || file.type === 'text/plain'
}

export default function NewWorkspacePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  // For single-file paste mode
  const [pastedContent, setPastedContent] = useState('')
  const [pastedFilename, setPastedFilename] = useState('readme.md')
  // For multi-file drop mode
  const [droppedFiles, setDroppedFiles] = useState<FileEntry[]>([])
  const [error, setError] = useState('')
  const [workspace, setWorkspace] = useState<CreatedWorkspace | null>(null)
  const [copiedKey, setCopiedKey] = useState<'read' | 'write' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  // Compute final files list from either mode
  const files: FileEntry[] = droppedFiles.length > 0
    ? droppedFiles
    : pastedContent
      ? [{ name: pastedFilename, content: pastedContent }]
      : []

  const handleShare = useCallback(async () => {
    if (files.length === 0) {
      setError('Please paste or drop some markdown')
      return
    }

    setStep('creating')
    setError('')

    try {
      const bootstrapRes = await fetch(`${API_URL}/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceName: generateWorkspaceName() }),
      })

      if (!bootstrapRes.ok) {
        throw new Error('Failed to create workspace')
      }

      const bootstrapData = await bootstrapRes.json()
      const writeKey = bootstrapData.data.keys.write
      const readKey = bootstrapData.data.keys.read

      // Use bulk create endpoint for efficiency
      const bulkFiles = files.map((file) => ({
        filename: file.name.endsWith('.md') ? file.name : `${file.name}.md`,
        content: file.content,
      }))

      const bulkRes = await fetch(`${API_URL}/w/${writeKey}/folders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: bulkFiles }),
      })

      if (!bulkRes.ok) {
        throw new Error('Failed to create files')
      }

      setWorkspace({
        readKey,
        writeKey,
      })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('input')
    }
  }, [files])

  const handleCopy = useCallback(async (key: 'read' | 'write', value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setDragCounter(0)

    const filesFromDrop = Array.from(e.dataTransfer.files).filter(isValidFile)
    if (filesFromDrop.length === 0) return

    // Clear pasted content when dropping files
    setPastedContent('')

    const readPromises = filesFromDrop.map(
      (file) =>
        new Promise<FileEntry>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            resolve({
              name: file.name.endsWith('.md') ? file.name : `${file.name}.md`,
              content: e.target?.result as string,
            })
          }
          reader.readAsText(file)
        })
    )

    Promise.all(readPromises).then((newFiles) => {
      setDroppedFiles((prev) => {
        const combined = [...prev, ...newFiles]
        if (combined.length > MAX_FILES) {
          setError(`Maximum ${MAX_FILES} files allowed`)
          return combined.slice(0, MAX_FILES)
        }
        setError('')
        return combined
      })
    })
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter((c) => c + 1)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter((c) => {
      const newCount = c - 1
      if (newCount === 0) {
        setIsDragging(false)
      }
      return newCount
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  if (step === 'done' && workspace) {
    const readUrl = `${window.location.origin}/r/${workspace.readKey}`
    const writeUrl = `${window.location.origin}/w/${workspace.writeKey}`

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center bg-sage mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold">Shared!</h1>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_0_var(--foreground)]">
              <p className="text-sm font-bold text-muted-foreground mb-2">Read link (anyone can view)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 font-mono text-sm break-all">{readUrl}</code>
                <button
                  onClick={() => handleCopy('read', readUrl)}
                  className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-background hover:bg-muted"
                >
                  {copiedKey === 'read' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_0_var(--foreground)]">
              <p className="text-sm font-bold text-muted-foreground mb-2">Write link (full control)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 font-mono text-sm break-all">{writeUrl}</code>
                <button
                  onClick={() => handleCopy('write', writeUrl)}
                  className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-background hover:bg-muted"
                >
                  {copiedKey === 'write' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-amber flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Save this — shown once!
              </p>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => router.push(`/r/${workspace.readKey}`)}
              className="flex-1 border-2 border-foreground bg-terracotta px-4 py-3 font-display font-bold text-white shadow-[3px_3px_0_0_var(--foreground)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Open workspace
            </button>
            <button
              onClick={() => {
                setStep('input')
                setPastedContent('')
                setPastedFilename('readme.md')
                setDroppedFiles([])
                setWorkspace(null)
              }}
              className="border-2 border-foreground bg-background px-4 py-3 font-display font-bold transition-all hover:bg-muted"
            >
              Share another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-muted p-6 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-terracotta/10 backdrop-blur-sm">
          <div className="border-4 border-dashed border-terracotta bg-background/95 p-12 text-center shadow-2xl">
            <Upload className="mx-auto h-16 w-16 text-terracotta mb-4" />
            <p className="font-display text-2xl font-bold text-terracotta">Drop your markdown file</p>
            <p className="mt-2 text-muted-foreground">.md or .markdown files</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Logo size="xl" showWordmark={false} />
          <h1 className="font-display text-3xl font-bold">Share your markdown</h1>
        </div>

        <div className="border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_var(--foreground)]">
          {droppedFiles.length === 0 ? (
            /* Paste mode - show textarea */
            <>
              <div className="mb-4 border-2 border-dashed border-foreground/30 bg-background p-4 min-h-[200px] relative transition-colors">
                {!pastedContent && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none">
                    <Upload className="h-8 w-8 mb-2" />
                    <p className="font-medium">Paste markdown or drop files anywhere</p>
                  </div>
                )}
                <textarea
                  value={pastedContent}
                  onChange={(e) => {
                    setPastedContent(e.target.value)
                    setError('')
                  }}
                  placeholder=""
                  className="w-full h-full min-h-[180px] bg-transparent font-mono text-sm resize-none focus:outline-none relative z-10"
                />
              </div>
              {pastedContent && (
                <div className="mb-4">
                  <label className="block text-sm font-bold mb-2">Filename</label>
                  <input
                    type="text"
                    value={pastedFilename}
                    onChange={(e) => setPastedFilename(e.target.value)}
                    className="w-full border-2 border-foreground/30 bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:border-foreground"
                  />
                </div>
              )}
            </>
          ) : (
            /* Dropped files mode - show file list */
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold">{droppedFiles.length} file{droppedFiles.length > 1 ? 's' : ''} ready to share</p>
                <button
                  onClick={() => setDroppedFiles([])}
                  className="text-sm text-muted-foreground hover:text-destructive"
                >
                  Clear all
                </button>
              </div>
              {droppedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 border-2 border-foreground/30 bg-background p-3">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={file.name}
                    onChange={(e) => {
                      const newFiles = [...droppedFiles]
                      newFiles[i] = { ...file, name: e.target.value }
                      setDroppedFiles(newFiles)
                    }}
                    className="flex-1 bg-transparent font-mono text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => setDroppedFiles(droppedFiles.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="mb-4 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}

          <button
            onClick={handleShare}
            disabled={step === 'creating' || files.length === 0}
            className="w-full border-2 border-foreground bg-terracotta px-4 py-3 font-display font-bold text-white shadow-[3px_3px_0_0_var(--foreground)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50"
          >
            {step === 'creating' ? 'Creating...' : `Share ${files.length > 1 ? `${files.length} files` : ''} →`}
          </button>
        </div>
      </div>
    </div>
  )
}

