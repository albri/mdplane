"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from '@mdplane/ui/lib/utils'
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
} from "lucide-react"
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useState,
} from "react"
import Link from "next/link"

const treeItemClassName =
  "flex w-full items-center gap-2 rounded-lg p-2 text-start text-muted-foreground wrap-anywhere outline-none transition-[color,box-shadow] [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent/50 hover:text-accent-foreground/80 hover:transition-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

const treeItemActiveClassName =
  "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary hover:transition-colors"

interface FileTreeContextType {
  expandedPaths: Set<string>
  togglePath: (path: string) => void
  selectedPath?: string
  onSelect?: (path: string) => void
}

const FileTreeContext = createContext<FileTreeContextType>({
  expandedPaths: new Set(),
  togglePath: () => undefined,
})

export type FileTreeProps = Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> & {
  expanded?: Set<string>
  defaultExpanded?: Set<string>
  selectedPath?: string
  onSelect?: (path: string) => void
  onExpandedChange?: (expanded: Set<string>) => void
}

export const FileTree = ({
  expanded: controlledExpanded,
  defaultExpanded = new Set(),
  selectedPath,
  onSelect,
  onExpandedChange,
  className,
  children,
  ...props
}: FileTreeProps) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const expandedPaths = controlledExpanded ?? internalExpanded

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setInternalExpanded(newExpanded)
    onExpandedChange?.(newExpanded)
  }

  return (
    <FileTreeContext.Provider
      value={{ expandedPaths, togglePath, selectedPath, onSelect }}
    >
      <div
        className={cn(
          "text-sm",
          className
        )}
        {...props}
      >
        <div>{children}</div>
      </div>
    </FileTreeContext.Provider>
  )
}

interface FileTreeFolderContextType {
  path: string
  name: string
  isExpanded: boolean
}

const FileTreeFolderContext = createContext<FileTreeFolderContextType>({
  path: "",
  name: "",
  isExpanded: false,
})

export type FileTreeFolderProps = Omit<HTMLAttributes<HTMLDivElement>, "tabIndex"> & {
  path: string
  name: string
}

export const FileTreeFolder = ({
  path,
  name,
  className,
  children,
  ...props
}: FileTreeFolderProps) => {
  const { expandedPaths, togglePath, selectedPath } =
    useContext(FileTreeContext)
  const isExpanded = expandedPaths.has(path)
  const isSelected = selectedPath === path || (!!selectedPath && selectedPath.startsWith(`${path}/`))
  const iconColorClassName = isSelected ? "text-primary" : "text-muted-foreground"

  return (
    <FileTreeFolderContext.Provider value={{ path, name, isExpanded }}>
      <Collapsible onOpenChange={() => togglePath(path)} open={isExpanded}>
        <div
          className={cn("", className)}
          {...props}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                treeItemClassName,
                isSelected && treeItemActiveClassName
              )}
              type="button"
            >
              <ChevronRight
                className={cn(
                  "transition-transform",
                  iconColorClassName,
                  isExpanded && "rotate-90"
                )}
              />
              <FileTreeIcon>
                {isExpanded ? (
                  <FolderOpen className={cn("size-4", iconColorClassName)} />
                ) : (
                  <Folder className={cn("size-4", iconColorClassName)} />
                )}
              </FileTreeIcon>
              <FileTreeName>{name}</FileTreeName>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-2 border-l border-border/60 pl-1.5">{children}</div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </FileTreeFolderContext.Provider>
  )
}

interface FileTreeFileContextType {
  path: string
  name: string
}

const FileTreeFileContext = createContext<FileTreeFileContextType>({
  path: "",
  name: "",
})

export type FileTreeFileProps = HTMLAttributes<HTMLAnchorElement> & {
  path: string
  name: string
  icon?: ReactNode
}

export const FileTreeFile = ({
  path,
  name,
  icon,
  className,
  children,
  ...props
}: FileTreeFileProps) => {
  const { selectedPath, onSelect } = useContext(FileTreeContext)
  const isSelected = selectedPath === path
  const iconColorClassName = isSelected ? "text-primary" : "text-muted-foreground"

  return (
    <FileTreeFileContext.Provider value={{ path, name }}>
      <Link
        href={path}
        data-selected={isSelected}
        className={cn(
          treeItemClassName,
          isSelected && treeItemActiveClassName,
          className
        )}
        onClick={(e) => {
          if (!onSelect) return
          e.preventDefault()
          onSelect(path)
        }}
        {...props}
      >
        {children ?? (
          <>
            <span className="size-4" />
            <FileTreeIcon className={cn("[&_svg]:text-current", iconColorClassName)}>
              {icon ?? <File className="size-4" />}
            </FileTreeIcon>
            <FileTreeName>{name}</FileTreeName>
          </>
        )}
      </Link>
    </FileTreeFileContext.Provider>
  )
}

export type FileTreeIconProps = HTMLAttributes<HTMLSpanElement>

export const FileTreeIcon = ({
  className,
  children,
  ...props
}: FileTreeIconProps) => (
  <span className={cn("shrink-0", className)} {...props}>
    {children}
  </span>
)

export type FileTreeNameProps = HTMLAttributes<HTMLSpanElement>

export const FileTreeName = ({
  className,
  children,
  ...props
}: FileTreeNameProps) => (
  <span className={cn("truncate", className)} {...props}>
    {children}
  </span>
)

export type FileTreeActionsProps = HTMLAttributes<HTMLDivElement>

export const FileTreeActions = ({
  className,
  children,
  ...props
}: FileTreeActionsProps) => (
  <div
    className={cn("ml-auto flex items-center gap-1", className)}
    onClick={(e) => e.stopPropagation()}
    onKeyDown={(e) => e.stopPropagation()}
    role="group"
    {...props}
  >
    {children}
  </div>
)


