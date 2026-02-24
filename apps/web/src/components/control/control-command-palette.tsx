"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ExternalLink,
  FolderPlus,
  Settings,
  SquareKanban,
  House,
  Key,
  Search,
  Webhook,
  type LucideIcon,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from '@mdplane/ui/lib/utils'
import {
  AUTH_FRONTEND_ROUTES,
  CONTROL_FRONTEND_ROUTES,
  WORKSPACE_FRONTEND_ROUTES,
} from "@mdplane/shared"
import { extractControlWorkspaceId } from "@/lib/control-workspace-routing"

interface CommandItem {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  section: "control" | "workspace" | "auth"
  keywords: string[]
}

function getCommands(workspaceId: string | null): CommandItem[] {
  const workspaceRootHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.workspace(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const orchestrationHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.orchestration(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const apiKeysHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.apiKeys(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const webhooksHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.webhooks(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root
  const settingsHref = workspaceId
    ? CONTROL_FRONTEND_ROUTES.settings(workspaceId)
    : CONTROL_FRONTEND_ROUTES.root

  return [
    {
      id: "control-welcome",
      label: "Control welcome",
      description: "Open workspace welcome dashboard",
      href: workspaceRootHref,
      icon: House,
      section: "control",
      keywords: ["control", "welcome", "overview", "dashboard"],
    },
    {
      id: "control-orchestration",
      label: "Orchestration",
      description: "Open orchestration board and filters",
      href: orchestrationHref,
      icon: SquareKanban,
      section: "control",
      keywords: ["orchestration", "tasks", "oversight"],
    },
    {
      id: "control-api-keys",
      label: "API keys",
      description: "Manage API key credentials for integrations",
      href: apiKeysHref,
      icon: Key,
      section: "control",
      keywords: ["api", "keys", "integrations"],
    },
    {
      id: "control-webhooks",
      label: "Webhooks",
      description: "Configure webhook endpoints and test deliveries",
      href: webhooksHref,
      icon: Webhook,
      section: "control",
      keywords: ["webhooks", "events", "notifications"],
    },
    {
      id: "control-settings",
      label: "Settings",
      description: "Open workspace settings and danger zone",
      href: settingsHref,
      icon: Settings,
      section: "control",
      keywords: ["settings", "danger", "rotate", "delete"],
    },
    {
      id: "workspace-launcher",
      label: "Workspace launcher",
      description: "Open workspace plane launcher",
      href: WORKSPACE_FRONTEND_ROUTES.launch,
      icon: ExternalLink,
      section: "workspace",
      keywords: ["workspace", "launcher", "runtime"],
    },
    {
      id: "create-workspace",
      label: "Create workspace",
      description: "Start bootstrap flow for a new workspace",
      href: AUTH_FRONTEND_ROUTES.bootstrap,
      icon: FolderPlus,
      section: "auth",
      keywords: ["bootstrap", "create", "workspace"],
    },
  ]
}

const SECTION_LABELS: Record<CommandItem["section"], string> = {
  auth: "Authentication",
  control: "Control",
  workspace: "Workspace",
}

function getSearchText(command: CommandItem) {
  return `${command.label} ${command.description} ${command.keywords.join(" ")}`
    .toLowerCase()
    .trim()
}

interface ControlCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ControlCommandPalette({
  open,
  onOpenChange,
}: ControlCommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const workspaceId = useMemo(() => extractControlWorkspaceId(pathname), [pathname])
  const commands = useMemo(
    () => getCommands(workspaceId),
    [workspaceId]
  )

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim()
    if (normalizedQuery.length === 0) {
      return commands
    }

    return commands.filter((command) =>
      getSearchText(command).includes(normalizedQuery)
    )
  }, [commands, query])

  const groupedCommands = useMemo(() => {
    const groups: Record<CommandItem["section"], CommandItem[]> = {
      auth: [],
      control: [],
      workspace: [],
    }
    for (const command of filteredCommands) {
      groups[command.section].push(command)
    }
    return groups
  }, [filteredCommands])

  const handleSelect = (command: CommandItem) => {
    onOpenChange(false)
    if (pathname !== command.href) {
      router.push(command.href)
    }
  }

  useEffect(() => {
    if (!open) {
      setQuery("")
      setActiveIndex(0)
      return
    }

    setActiveIndex(0)
  }, [open, filteredCommands.length])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCommands.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filteredCommands.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex(
        (prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length
      )
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      const selected = filteredCommands[activeIndex]
      if (selected) {
        handleSelect(selected)
      }
    }
  }

  const hasResults = filteredCommands.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Command Palette</DialogTitle>
        <DialogDescription>Quick navigation across app surfaces</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <div className="flex h-12 items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <label htmlFor="control-command-palette-search" className="sr-only">
            Search commands
          </label>
          <input
            id="control-command-palette-search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            aria-label="Search commands"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-[380px] overflow-y-auto p-2">
          {!hasResults ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No commands found.
            </p>
          ) : (
            Object.entries(groupedCommands).map(([section, items]) => {
              if (items.length === 0) return null

              return (
                <div key={section} className="mb-3 last:mb-0">
                  <p className="px-2 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {SECTION_LABELS[section as CommandItem["section"]]}
                  </p>
                  <div className="mt-1 flex flex-col">
                    {items.map((item) => {
                      const itemIndex = filteredCommands.findIndex(
                        (candidate) => candidate.id === item.id
                      )
                      const isActive = activeIndex === itemIndex
                      const Icon = item.icon

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          className={cn(
                            "flex items-start gap-2 rounded-md px-2 py-2 text-left outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                            isActive
                              ? "bg-muted text-foreground"
                              : "text-foreground hover:bg-muted/70"
                          )}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

