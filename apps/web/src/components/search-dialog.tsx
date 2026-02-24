'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { File, ListChecks, Layers } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@mdplane/ui/ui/button'
import { useSearch, type SearchResult, type SearchHighlight } from '@/hooks/use-search'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  readKey: string
}

function HighlightedContent({
  content,
  highlights,
}: {
  content: string
  highlights: SearchHighlight[]
}) {
  if (highlights.length === 0) {
    return <span>{content}</span>
  }

  // Sort highlights by start position
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)
  const parts: React.ReactNode[] = []
  let lastEnd = 0

  sortedHighlights.forEach((highlight, index) => {
    // Add text before highlight
    if (highlight.start > lastEnd) {
      parts.push(content.slice(lastEnd, highlight.start))
    }
    // Add highlighted text
    parts.push(
      <mark key={index} className="bg-status-claimed/10">
        {content.slice(highlight.start, highlight.end)}
      </mark>
    )
    lastEnd = highlight.end
  })

  // Add remaining text after last highlight
  if (lastEnd < content.length) {
    parts.push(content.slice(lastEnd))
  }

  return <span>{parts}</span>
}

function ResultTypeIcon({ type }: { type: SearchResult['type'] }) {
  switch (type) {
    case 'file':
      return <File className="size-4 shrink-0 text-muted-foreground" />
    case 'task':
      return <ListChecks className="size-4 shrink-0 text-muted-foreground" />
    case 'append':
      return <Layers className="size-4 shrink-0 text-muted-foreground" />
    default:
      return <File className="size-4 shrink-0 text-muted-foreground" />
  }
}

export function SearchDialog({ open, onOpenChange, readKey }: SearchDialogProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [kind, setKind] = React.useState<'all' | 'file' | 'task' | 'append'>('all')

  const { data, isLoading } = useSearch(readKey, query)

  const handleSelect = React.useCallback(
    (result: SearchResult) => {
      onOpenChange(false)
      if (result.file?.path) {
        router.push(`/r/${readKey}${result.file.path}`)
      }
    },
    [router, readKey, onOpenChange]
  )

  // Reset query when dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery('')
      setKind('all')
    }
  }, [open])

  const results = React.useMemo(() => {
    const all = data?.results ?? []
    if (kind === 'all') return all
    return all.filter((r) => r.type === kind)
  }, [data?.results, kind])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Lexical search across files and appends (deleted items excluded)"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Search files, tasks, and appends..."
        aria-label="Search files, tasks, and appends"
        value={query}
        onValueChange={setQuery}
      />

      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Button
          type="button"
          variant={kind === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setKind('all')}
        >
          All
        </Button>
        <Button
          type="button"
          variant={kind === 'file' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setKind('file')}
        >
          Files
        </Button>
        <Button
          type="button"
          variant={kind === 'task' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setKind('task')}
        >
          Tasks
        </Button>
        <Button
          type="button"
          variant={kind === 'append' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setKind('append')}
        >
          Appends
        </Button>
      </div>

      <CommandList data-testid="search-results">
        {query.length === 0 ? (
          <CommandEmpty>Type to search...</CommandEmpty>
        ) : isLoading ? (
          <CommandEmpty>Searching...</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No results found.</CommandEmpty>
        ) : (
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={result.id}
                value={`${result.id} ${result.file?.path ?? ''} ${result.content}`.trim()}
                data-testid="search-result-item"
                onSelect={() => handleSelect(result)}
                className="flex flex-col items-start gap-1 py-3"
              >
                <div className="flex w-full items-center gap-2">
                  <ResultTypeIcon type={result.type} />
                  {result.file?.path && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {result.file.path}
                    </span>
                  )}
                </div>
                <div className="line-clamp-2 text-sm">
                  <HighlightedContent
                    content={result.content}
                    highlights={result.highlights}
                  />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

