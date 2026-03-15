'use client'

import { FileTree, FileTreeFile, FileTreeFolder } from '@/components/ui/file-tree'
import type { PageTreeNode, PageTreeRoot } from '@/lib/capability/fetch-folder-tree'
import type { KeyType } from '@mdplane/shared'
import { cn } from '@mdplane/ui/lib/utils'
import { File, FileText } from 'lucide-react'
import { useMemo } from 'react'

function getFileIcon(name: string) {
  if (name.endsWith('.md') || !name.includes('.')) {
    return <FileText className="size-4" />
  }
  return <File className="size-4" />
}

function hasFileNodeAtPath(tree: PageTreeRoot, selectedPath: string) {
  const stack: PageTreeNode[] = [...tree.children]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    if (current.type === 'page' && current.url === selectedPath) return true
    if (current.type === 'folder') stack.push(...current.children)
  }
  return false
}

function getExpandedFolderPaths({
  selectedPath,
  capabilityKey,
  keyType,
  isFile,
}: {
  selectedPath: string
  capabilityKey: string
  keyType: KeyType
  isFile: boolean
}) {
  const prefix = `/${keyType}/${capabilityKey}/`
  if (!selectedPath.startsWith(prefix)) return new Set<string>()

  const relativePath = selectedPath.slice(prefix.length)
  if (!relativePath) return new Set<string>()

  const segments = relativePath.split('/').filter(Boolean)
  const maxDepth = isFile ? Math.max(segments.length - 1, 0) : segments.length
  const expanded = new Set<string>()
  let current = ''

  for (let index = 0; index < maxDepth; index += 1) {
    current = current ? `${current}/${segments[index]}` : segments[index]
    expanded.add(current)
  }

  return expanded
}

function TreeNode({
  node,
  selectedPath,
  parentPath = '',
}: {
  node: PageTreeNode
  selectedPath: string
  parentPath?: string
}) {
  if (node.type === 'page') {
    const isSelected = selectedPath === node.url
    return (
      <FileTreeFile
        path={node.url}
        name={node.name}
        icon={getFileIcon(node.name)}
        className={cn({
          'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary': isSelected,
        })}
      />
    )
  }

  const folderPath = parentPath ? `${parentPath}/${node.name}` : node.name

  return (
    <FileTreeFolder path={folderPath} name={node.name}>
      {node.children.map((child, i) => (
        <TreeNode
          key={child.type === 'page' ? child.url : `${child.name}-${i}`}
          node={child}
          selectedPath={selectedPath}
          parentPath={folderPath}
        />
      ))}
    </FileTreeFolder>
  )
}

interface SidebarFileTreeProps {
  pageTree: PageTreeRoot
  pathname: string
  keyType: KeyType
  capabilityKey: string
  onSelect: (path: string) => void
}

export function SidebarFileTree({
  pageTree,
  pathname,
  keyType,
  capabilityKey,
  onSelect,
}: SidebarFileTreeProps) {
  const isFilePath = useMemo(() => hasFileNodeAtPath(pageTree, pathname), [pageTree, pathname])
  const defaultExpanded = useMemo(
    () =>
      getExpandedFolderPaths({
        selectedPath: pathname,
        capabilityKey,
        keyType,
        isFile: isFilePath,
      }),
    [capabilityKey, isFilePath, keyType, pathname]
  )

  if (pageTree.children.length === 0) {
    return (
      <div
        data-testid="sidebar-empty-state"
        className="rounded-md border border-border/70 bg-muted/30 px-3 py-3 text-xs text-muted-foreground"
      >
        <p className="font-medium text-foreground">No files yet</p>
        <p className="mt-1">
          Create your first markdown file from the runtime onboarding panel.
        </p>
      </div>
    )
  }

  return (
    <FileTree
      key={pathname}
      defaultExpanded={defaultExpanded}
      selectedPath={pathname}
      onSelect={onSelect}
      className="p-0"
    >
      {pageTree.children.map((node, i) => (
        <TreeNode
          key={node.type === 'page' ? node.url : `${node.name}-${i}`}
          node={node}
          selectedPath={pathname}
        />
      ))}
    </FileTree>
  )
}

