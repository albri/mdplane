'use client'

import { useState } from 'react'
import { Plus, FolderPlus } from 'lucide-react'
import { CreateFileDialog } from './create-file-dialog'
import { CreateFolderDialog } from './create-folder-dialog'

interface WriteFolderActionsProps {
  capabilityKey: string
  folderPath: string
  onFileCreated?: () => void
}

export function WriteFolderActions({
  capabilityKey,
  folderPath,
  onFileCreated,
}: WriteFolderActionsProps) {
  const [showCreateFile, setShowCreateFile] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)

  return (
    <div className="flex items-center justify-between border-b-2 border-foreground pb-4">
      <div>
        <h1 className="font-display text-2xl font-bold">
          {folderPath ? `/${folderPath}` : 'Workspace'}
        </h1>
        <p className="text-sm text-muted-foreground">Write access</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowCreateFile(true)}
          className="flex items-center gap-2 border-2 border-foreground bg-terracotta px-3 py-2 font-display font-bold text-background shadow-[2px_2px_0_0_var(--foreground)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          <Plus className="h-4 w-4" />
          New file
        </button>
        <button
          onClick={() => setShowCreateFolder(true)}
          className="flex items-center gap-2 border-2 border-foreground bg-background px-3 py-2 font-display font-bold shadow-[2px_2px_0_0_var(--foreground)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        >
          <FolderPlus className="h-4 w-4" />
          New folder
        </button>
      </div>

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

      {showCreateFolder && (
        <CreateFolderDialog
          capabilityKey={capabilityKey}
          folderPath={folderPath}
          onClose={() => setShowCreateFolder(false)}
          onCreated={() => {
            setShowCreateFolder(false)
            onFileCreated?.()
          }}
        />
      )}
    </div>
  )
}

