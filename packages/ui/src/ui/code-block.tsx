'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, Clipboard } from 'lucide-react'
import { cn } from '../lib/utils'
import { highlightCodeBlockHtml, type ShikiThemePair } from './shiki'

interface CodeBlockProps {
  children?: ReactNode
  code?: string
  language?: string
  showLanguageHeader?: boolean
  className?: string
  title?: string
  allowCopy?: boolean
  keepBackground?: boolean
  themes?: Partial<ShikiThemePair>
  viewportClassName?: string
  'data-testid'?: string
}

function extractCodeFromChildren(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractCodeFromChildren).join('')
  if (children != null && typeof children === 'object' && 'props' in children) {
    const node = children as { props?: { children?: ReactNode } }
    return extractCodeFromChildren(node.props?.children)
  }
  return ''
}

function stripSingleTrailingNewline(value: string): string {
  if (value.endsWith('\r\n')) return value.slice(0, -2)
  if (value.endsWith('\n')) return value.slice(0, -1)
  return value
}

interface ParsedShikiBlock {
  preClassName: string
  figureStyle?: CSSProperties
  codeHtml: string
}

function styleToObject(styleString: string): CSSProperties {
  const result: Record<string, string> = {}

  for (const declaration of styleString.split(';')) {
    const pair = declaration.trim()
    if (pair === '') continue

    const separatorIndex = pair.indexOf(':')
    if (separatorIndex <= 0) continue

    const rawName = pair.slice(0, separatorIndex).trim()
    const rawValue = pair.slice(separatorIndex + 1).trim()
    if (rawName === '' || rawValue === '') continue

    if (rawName.startsWith('--')) {
      result[rawName] = rawValue
      continue
    }

    const reactName = rawName.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
    result[reactName] = rawValue
  }

  return result as CSSProperties
}

function parseHighlightedBlock(html: string): ParsedShikiBlock | null {
  const preMatch = /<pre\b([^>]*)>([\s\S]*?)<\/pre>/i.exec(html)
  if (preMatch == null) return null

  const attrs = preMatch[1] ?? ''
  const preInnerHtml = preMatch[2] ?? ''
  const codeMatch = /<code\b[^>]*>([\s\S]*?)<\/code>/i.exec(preInnerHtml)
  const codeHtml = codeMatch?.[1] ?? ''

  const classMatch = /class="([^"]*)"/i.exec(attrs)
  const preClassName = classMatch?.[1] != null ? classMatch[1].trim() : ''

  const parsed: ParsedShikiBlock = { preClassName, codeHtml }
  const styleMatch = /style="([^"]*)"/i.exec(attrs)
  if (styleMatch?.[1] != null) {
    parsed.figureStyle = styleToObject(styleMatch[1])
  }

  return parsed
}

const LANGUAGE_LABELS: Partial<Record<string, string>> = {
  bash: 'Bash',
  sh: 'Bash',
  zsh: 'Bash',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TypeScript',
  jsx: 'JavaScript',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  markdown: 'Markdown',
  md: 'Markdown',
}

function toLanguageLabel(language: string): string | null {
  const normalized = language.trim().toLowerCase().replace(/^language-/, '')
  if (normalized === '' || normalized === 'text' || normalized === 'plaintext') return null

  if (LANGUAGE_LABELS[normalized] != null) return LANGUAGE_LABELS[normalized]

  return normalized
    .split(/[-_]/g)
    .map((part) => (part === '' ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

export function CodeBlock({
  children,
  code,
  language = 'text',
  showLanguageHeader = true,
  className,
  title,
  allowCopy = true,
  keepBackground = false,
  themes,
  viewportClassName,
  'data-testid': testId,
}: CodeBlockProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const rawCode = useMemo(() => code ?? extractCodeFromChildren(children), [code, children])
  const normalizedCode = useMemo(() => stripSingleTrailingNewline(rawCode), [rawCode])
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true

    const shikiOptions = themes != null ? { language, themes } : { language }

    void highlightCodeBlockHtml(normalizedCode, shikiOptions)
      .then((html) => {
        if (active) setHighlightedHtml(html)
      })
      .catch(() => {
        if (active) setHighlightedHtml('')
      })

    return () => {
      active = false
    }
  }, [normalizedCode, language, themes])

  const parsedBlock = useMemo(() => parseHighlightedBlock(highlightedHtml), [highlightedHtml])
  const languageLabel = useMemo(
    () => (showLanguageHeader ? toLanguageLabel(language) : null),
    [language, showLanguageHeader]
  )
  const hasLanguageHeader = languageLabel != null
  const hasTitle = title != null && title !== ''
  const showTitle = hasTitle && hasLanguageHeader
  const useHeaderCopy = hasLanguageHeader && allowCopy
  const useOverlayCopy = !hasLanguageHeader && allowCopy

  const onCopy = async () => {
    try {
      const pre = viewportRef.current?.getElementsByTagName('pre').item(0)
      if (pre == null) return

      const clone = pre.cloneNode(true) as HTMLElement
      clone.querySelectorAll('.nd-copy-ignore').forEach((node) => {
        node.replaceWith('\n')
      })

      await navigator.clipboard.writeText(clone.textContent || '')
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 1500)
    } catch {
      // no-op: clipboard not available
    }
  }

  return (
    <figure
      dir="ltr"
      tabIndex={-1}
      data-testid={testId}
      className={cn(
        'my-4 rounded-xl border border-border/80 bg-secondary text-sm shadow-sm not-prose relative overflow-hidden shiki',
        parsedBlock?.preClassName,
        className
      )}
      style={parsedBlock?.figureStyle}
    >
      {hasLanguageHeader ? (
        <div className="flex w-full items-center gap-3.5 overflow-x-auto px-4 text-secondary-foreground not-prose">
          <div className="whitespace-nowrap py-3 text-xs font-normal uppercase text-muted-foreground font-mono">
            {languageLabel}
          </div>
          {useHeaderCopy ? (
            <button
              type="button"
              data-checked={copied || undefined}
              onClick={() => {
                void onCopy()
              }}
              aria-label={copied ? 'Copied Text' : 'Copy Text'}
              className="ml-auto inline-flex items-center justify-center rounded-md p-1 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 data-[checked=true]:text-foreground"
            >
              {copied ? <Check /> : <Clipboard />}
            </button>
          ) : null}
        </div>
      ) : null}

      {showTitle ? (
        <div className="flex h-9.5 items-center gap-2 border-b px-4 text-muted-foreground">
          <figcaption className="flex-1 truncate">{title}</figcaption>
          {allowCopy && !useHeaderCopy ? (
            <button
              type="button"
              data-checked={copied || undefined}
              onClick={() => {
                void onCopy()
              }}
              aria-label={copied ? 'Copied Text' : 'Copy Text'}
              className="inline-flex items-center justify-center rounded-md p-1 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 data-[checked=true]:text-foreground"
            >
              {copied ? <Check /> : <Clipboard />}
            </button>
          ) : null}
        </div>
      ) : useOverlayCopy ? (
        <div className="absolute top-3 right-2 z-[2] rounded-lg text-muted-foreground backdrop-blur-lg">
          <button
            type="button"
            data-checked={copied || undefined}
            onClick={() => {
              void onCopy()
            }}
            aria-label={copied ? 'Copied Text' : 'Copy Text'}
            className="inline-flex items-center justify-center rounded-md p-1 text-sm font-medium transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 data-[checked=true]:text-foreground"
          >
            {copied ? <Check /> : <Clipboard />}
          </button>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        role="region"
        tabIndex={0}
        style={
          {
            '--padding-left': 'calc(var(--spacing) * 4)',
            '--padding-right':
              !showTitle
                ? useOverlayCopy
                  ? 'calc(var(--spacing) * 8)'
                  : 'calc(var(--spacing) * 4)'
                : 'calc(var(--spacing) * 4)',
          } as CSSProperties
        }
        className={cn(
          'max-h-[600px] overflow-auto rounded-xl py-3.5 text-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          keepBackground ? 'bg-[--shiki-light-bg] dark:bg-[--shiki-dark-bg]' : 'bg-card',
          viewportClassName
        )}
      >
        {parsedBlock != null ? (
          <pre className="w-max min-w-full *:flex *:flex-col">
            <code dangerouslySetInnerHTML={{ __html: parsedBlock.codeHtml }} />
          </pre>
        ) : (
          <pre className="w-max min-w-full *:flex *:flex-col">
            <code>{normalizedCode}</code>
          </pre>
        )}
      </div>
    </figure>
  )
}
