'use client'

import { useState } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { env } from '@/config/env'

const API_URL = env.NEXT_PUBLIC_API_URL

interface CreateFileDialogProps {
  capabilityKey: string
  folderPath: string
  onClose: () => void
  onCreated: () => void
}

export function CreateFileDialog({
  capabilityKey,
  folderPath,
  onClose,
  onCreated,
}: CreateFileDialogProps) {
  const [filename, setFilename] = useState('readme.md')
  const [content, setContent] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!filename.trim()) {
      setError('Filename is required')
      return
    }

    const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`

    setIsCreating(true)
    setError('')

    try {
      const path = folderPath ? `${folderPath}/${finalFilename}` : finalFilename
      const res = await fetch(`${API_URL}/w/${capabilityKey}/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to create file')
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
      <div className="w-full max-w-2xl border-2 border-foreground bg-card p-6 shadow-[8px_8px_0_0_var(--foreground)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">Create new file</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="readme.md"
              className="w-full border-2 border-foreground bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Content (optional)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Your markdown here..."
              rows={10}
              className="w-full border-2 border-foreground bg-background px-3 py-2 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 font-display font-bold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex items-center gap-2 border-2 border-foreground bg-terracotta px-4 py-2 font-display font-bold text-background shadow-[2px_2px_0_0_var(--foreground)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Create file
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

