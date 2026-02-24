'use client'

import React, { type ComponentProps, type ReactNode } from 'react'
import Image from 'next/image'
import type { Components } from 'react-markdown'
import {
  Link as LinkIcon,
} from 'lucide-react'
import { MarkdownCallout } from '@mdplane/ui'
import { cn } from '@mdplane/ui/lib/utils'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function getTextContent(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(getTextContent).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return getTextContent((children as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

type GitHubAlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'
type GitHubAlertTone = 'note' | 'tip' | 'important' | 'warning' | 'caution'

const GITHUB_ALERT_REGEX = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

const GITHUB_ALERT_TONE_MAP: Record<GitHubAlertType, GitHubAlertTone> = {
  NOTE: 'note',
  TIP: 'tip',
  IMPORTANT: 'important',
  WARNING: 'warning',
  CAUTION: 'caution',
}

interface ParsedGitHubAlert {
  type: GitHubAlertType
  children: ReactNode
}

function stripMarkerFromNode(node: ReactNode, markerRegex: RegExp, state: { removed: boolean }): ReactNode {
  if (state.removed) return node

  if (typeof node === 'string') {
    const nextValue = node.replace(markerRegex, '').replace(/^\s+/, '')
    if (nextValue !== node) {
      state.removed = true
    }
    return nextValue
  }

  if (Array.isArray(node)) {
    return node.map((child) => stripMarkerFromNode(child, markerRegex, state))
  }

  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    if (node.props.children === undefined) {
      return node
    }

    const nextChildren = stripMarkerFromNode(node.props.children, markerRegex, state)
    if (nextChildren === node.props.children) {
      return node
    }

    return React.cloneElement(node, undefined, nextChildren)
  }

  return node
}

function isVisuallyEmpty(node: ReactNode): boolean {
  if (typeof node === 'string') return node.trim().length === 0
  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    return getTextContent(node.props.children).trim().length === 0
  }
  return false
}

export function parseGitHubAlertFromBlockquote(children: ReactNode): ParsedGitHubAlert | null {
  const childNodes = React.Children.toArray(children)
  const firstContentNode = childNodes.find((node) => !isVisuallyEmpty(node))

  if (!firstContentNode) {
    return null
  }

  const firstText = getTextContent(firstContentNode).trimStart()
  const markerMatch = firstText.match(GITHUB_ALERT_REGEX)
  if (!markerMatch) {
    return null
  }

  const alertType = markerMatch[1].toUpperCase() as GitHubAlertType
  const state = { removed: false }
  const strippedFirstNode = stripMarkerFromNode(firstContentNode, GITHUB_ALERT_REGEX, state)

  const nextChildren = childNodes
    .map((node) => (node === firstContentNode ? strippedFirstNode : node))
    .filter((node) => !isVisuallyEmpty(node))

  return {
    type: alertType,
    children: nextChildren,
  }
}

function Heading({
  as: As,
  className,
  children,
  ...props
}: ComponentProps<'h1'> & { as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' }) {
  const text = getTextContent(children)
  const id = props.id ?? (text ? slugify(text) : undefined)

  if (!id) {
    return (
      <As className={className} {...props}>
        {children}
      </As>
    )
  }

  return (
    <As className={cn('flex scroll-m-28 flex-row items-center gap-2', className)} id={id} {...props}>
      <a data-card="" href={`#${id}`} className="peer">
        {children}
      </a>
      <LinkIcon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity peer-hover:opacity-100"
      />
    </As>
  )
}

export const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <Heading as="h1" className={cn('mb-6 text-[1.75em] font-semibold', className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <Heading as="h2" className={cn('mb-4 mt-10 text-2xl font-semibold', className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <Heading as="h3" className={cn('mb-3 mt-8 text-xl font-semibold', className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <Heading as="h4" className={cn('mb-2 mt-6 text-lg font-semibold', className)} {...props} />
  ),
  h5: ({ className, ...props }) => (
    <Heading as="h5" className={cn('mb-2 mt-4 text-base font-semibold', className)} {...props} />
  ),
  h6: ({ className, ...props }) => (
    <Heading as="h6" className={cn('mb-2 mt-4 text-sm font-semibold', className)} {...props} />
  ),
  a: ({ href, children, className, ...props }) => {
    if (!href || typeof href !== 'string') {
      return <span {...props}>{children}</span>
    }

    const isSafe = !href.toLowerCase().startsWith('javascript:') && !href.toLowerCase().startsWith('data:')
    if (!isSafe) {
      return <span {...props}>{children}</span>
    }

    const isExternal = href.startsWith('http')
    return (
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className={cn(
          'font-medium underline decoration-primary decoration-1.5 underline-offset-[3.5px] transition-opacity hover:opacity-80',
          className
        )}
        {...props}
      >
        {children}
      </a>
    )
  },
  img: ({ src, alt, className, title }) => {
    if (!src || typeof src !== 'string') return null
    const isSafe = !src.toLowerCase().startsWith('javascript:') && !src.toLowerCase().startsWith('data:')
    if (!isSafe) return null

    return (
      <Image
        src={src}
        alt={alt ?? ''}
        width={1200}
        height={630}
        unoptimized
        sizes="100vw"
        title={title}
        className={cn('h-auto max-w-full rounded-lg', className)}
      />
    )
  },
  table: ({ className, children, ...props }) => (
    <div className="relative my-6 overflow-auto prose-no-margin">
      <table className={cn('prose-no-margin', className)} {...props}>
        {children}
      </table>
    </div>
  ),
  blockquote: ({ className, children, ...props }) => {
    const parsedAlert = parseGitHubAlertFromBlockquote(children)

    if (parsedAlert) {
      const tone = GITHUB_ALERT_TONE_MAP[parsedAlert.type]

      return (
        <MarkdownCallout
          tone={tone}
          className={cn('my-4', className)}
          aria-label={`${parsedAlert.type.toLowerCase()} callout`}
          data-alert={parsedAlert.type.toLowerCase()}
        >
          {parsedAlert.children}
        </MarkdownCallout>
      )
    }

    return (
      <blockquote
        className={cn('my-8 border-s-4 border-border ps-4 font-medium italic text-foreground', className)}
        {...props}
      >
        {children}
      </blockquote>
    )
  },
}
