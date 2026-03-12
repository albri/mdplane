'use client'

import { useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { CreateFileDialog } from './create-file-dialog'

interface EmptyFolderStateProps {
  capabilityKey: string
  folderPath: string
  onFileCreated?: () => void
}

export function EmptyFolderState({
  capabilityKey,
  folderPath,
  onFileCreated,
}: EmptyFolderStateProps) {
  const [showCreateFile, setShowCreateFile] = useState(false)

  return (
    <div className="border-2 border-dashed border-foreground/30 bg-background p-12 text-center">
      <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">No files yet</h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        This folder is empty. Create your first markdown file to get started.
      </p>

      <button
        onClick={() => setShowCreateFile(true)}
        className="inline-flex items-center gap-2 border-2 border-foreground bg-terracotta px-4 py-3 font-display font-bold text-background shadow-[4px_4px_0_0_var(--foreground)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
      >
        <Upload className="h-4 w-4" />
        Create your first file
      </button>

      {showCreateFile && (
        <CreateFileDialog
          capabilityKey={capabilityKey}
          folderPath={folderPath}
          onClose={() => setShowCreateFile(false)}
          onCreated={() => {
            setShowCreateFile(false)
            onFileCreated?.()
          }}
        />
      )}
    </div>
  )
}

