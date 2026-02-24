'use client'

import {
  Folder,
  File,
  FileText,
  FileCode,
  Image,
  FileType2,
  FileArchive,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@mdplane/ui/lib/utils'

interface FileIconProps {
  type: 'file' | 'folder'
  name: string
  className?: string
}

function getIconForExtension(ext?: string): LucideIcon {
  switch (ext) {
    // Markdown
    case 'md':
    case 'mdx':
      return FileText

    // Code
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'json':
    case 'yaml':
    case 'yml':
    case 'py':
    case 'rb':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
    case 'css':
    case 'scss':
    case 'html':
    case 'xml':
    case 'sh':
    case 'bash':
      return FileCode

    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
    case 'bmp':
      return Image

    // PDF
    case 'pdf':
      return FileType2

    // Archives
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
    case '7z':
      return FileArchive

    // Default
    default:
      return File
  }
}

export function FileIcon({ type, name, className = 'h-5 w-5' }: FileIconProps) {
  if (type === 'folder') {
    return (
      <Folder
        className={cn(className, 'text-primary')}
        data-testid="folder-icon"
      />
    )
  }

  const extension = name.split('.').pop()?.toLowerCase()
  const Icon = getIconForExtension(extension)

  return (
    <Icon
      className={cn(className, 'text-muted-foreground')}
      data-testid="file-icon"
    />
  )
}


