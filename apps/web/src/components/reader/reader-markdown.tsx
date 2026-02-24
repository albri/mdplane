'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Append } from '@mdplane/shared'
import { cn } from '@mdplane/ui/lib/utils'
import { AppendSection } from './appends'
import { markdownComponents } from './mdx-components'
import { CodeBlock } from '@mdplane/ui/ui/code-block'
import { stripLeadingFrontmatter } from '@/lib/markdown/strip-frontmatter'

const MermaidComponent = dynamic(() => import('@/components/mermaid-component'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[220px] rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      Loading diagram...
    </div>
  ),
})

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className'],
    pre: [...(defaultSchema.attributes?.pre || []), 'className'],
    h1: [...(defaultSchema.attributes?.h1 || []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 || []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 || []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 || []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 || []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 || []), 'id'],
  },
}

const MARKDOWN_COMPONENTS: Components = {
  ...markdownComponents,
  pre: ({ children }) => {
    const codeElement = React.Children.toArray(children).find(
      (child): child is React.ReactElement => React.isValidElement(child)
    ) as React.ReactElement<{ className?: string; children?: unknown }> | undefined

    if (codeElement) {
      const codeClassName = codeElement.props.className || ''
      const isMermaid = codeClassName.includes('language-mermaid')

      if (isMermaid) {
        const rawChildren = codeElement.props.children
        const codeContent = Array.isArray(rawChildren)
          ? rawChildren.join('')
          : String(rawChildren ?? '')

        if (codeContent.trim().length > 0) {
          return (
            <div className="my-4 flex w-full items-center justify-center" data-testid="mermaid-diagram">
              <MermaidComponent chart={codeContent} />
            </div>
          )
        }
      }
    }

    const className = codeElement?.props.className ?? ''
    const language = className.replace(/^language-/, '') || 'text'
    const rawChildren = codeElement?.props.children
    const code = Array.isArray(rawChildren) ? rawChildren.join('') : String(rawChildren ?? '')

    return (
      <CodeBlock
        code={code}
        language={language}
        className="my-4"
        viewportClassName="reader-scroll-container"
      />
    )
  },
}

interface ReaderMarkdownProps {
  content: string
  appends?: Append[]
  className?: string
}

export function ReaderMarkdown({ content, appends, className }: ReaderMarkdownProps) {
  const cleanedContent = useMemo(() => {
    const withoutFrontmatter = stripLeadingFrontmatter(content)
    const appendPattern = /<!--\s*append\s+id:\w+[^>]*-->/g
    return withoutFrontmatter.replace(appendPattern, '')
  }, [content])

  return (
    <div className={cn('prose-reader prose text-[0.96rem] leading-7 text-foreground', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={MARKDOWN_COMPONENTS}
      >
        {cleanedContent}
      </Markdown>
      <AppendSection appends={appends || []} />
    </div>
  )
}

