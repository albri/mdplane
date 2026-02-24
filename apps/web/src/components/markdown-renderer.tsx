'use client';

import { useMemo } from 'react';
import React from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@mdplane/ui/lib/utils';
import type { Append } from '@mdplane/shared';
import { CodeBlock } from '@mdplane/ui/ui/code-block';
import { stripLeadingFrontmatter } from '@/lib/markdown/strip-frontmatter';

function sanitizeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
    return undefined;
  }

  return trimmed;
}

const MermaidComponent = dynamic(() => import('./mermaid-component'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[220px] rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      Loading diagram...
    </div>
  )
});

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-xl font-semibold text-foreground mt-6 mb-3" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-lg font-medium text-foreground mt-4 mb-2" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-base font-medium text-foreground mt-4 mb-2" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-base text-foreground leading-relaxed mb-4" {...props}>
      {children}
    </p>
  ),
  pre: ({ children }) => {
    const codeElement = React.Children.toArray(children).find(
      (child): child is React.ReactElement => React.isValidElement(child)
    ) as React.ReactElement<{ className?: string; children?: unknown }> | undefined;

    if (codeElement) {
      const codeClassName = codeElement.props.className || '';
      const isMermaid = codeClassName.includes('language-mermaid');

      if (isMermaid) {
        const rawChildren = codeElement.props.children;
        const codeContent = Array.isArray(rawChildren)
          ? rawChildren.join('')
          : String(rawChildren ?? '');

        if (codeContent.trim().length > 0) {
          return (
            <div className="my-4 flex w-full items-center justify-center">
              <MermaidComponent chart={codeContent} />
            </div>
          );
        }
      }
    }

    const className = codeElement?.props.className ?? '';
    const language = className.replace(/^language-/, '') || 'text';
    const rawChildren = codeElement?.props.children;
    const code = Array.isArray(rawChildren) ? rawChildren.join('') : String(rawChildren ?? '');

    return (
      <CodeBlock
        code={code}
        language={language}
        className="mb-4"
        viewportClassName="reader-scroll-container"
      />
    );
  },
  code: ({ className: codeClassName, children, ...props }) => {
    const isInline = !codeClassName;
    if (isInline) {
      return (
          <code
            className="bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
            {...props}
          >
            {children}
        </code>
      );
    }
    return (
      <code className={cn('font-mono text-sm', codeClassName)} {...props}>
        {children}
      </code>
    );
  },
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside mb-4 space-y-1 text-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-base leading-relaxed" {...props}>
      {children}
    </li>
  ),
  input: ({ type, checked, ...props }) => {
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mr-2 h-4 w-4 accent-status-completed pointer-events-none"
          {...props}
        />
      );
    }
    return <input type={type} {...props} />;
  },
  a: ({ href, children, ...props }) => (
    (() => {
      const safeHref = sanitizeUrl(href);
      if (!safeHref) {
          return (
          <span className="text-primary" {...props}>
            {children}
          </span>
        );
      }

        return (
          <a
            href={safeHref}
            className="text-primary hover:underline"
            target={safeHref.startsWith('http') ? '_blank' : undefined}
            rel={safeHref.startsWith('http') ? 'noopener noreferrer' : undefined}
            {...props}
        >
          {children}
        </a>
      );
    })()
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full border-collapse border border-border text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-border bg-secondary px-4 py-2 text-left text-sm font-medium text-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-4 py-2 text-sm text-foreground" {...props}>
      {children}
    </td>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-4 border-border pl-4 my-4 text-muted-foreground italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="my-6 border-t border-border" {...props} />,
  img: ({ src, alt, title }) => (
    (() => {
      const safeSrc = sanitizeUrl(src);
      if (!safeSrc) {
        return null;
      }
      return (
        <Image
          src={safeSrc}
          alt={alt ?? ''}
          width={1200}
          height={630}
          unoptimized
          sizes="100vw"
          title={title}
          className="my-4 h-auto max-w-full rounded-lg"
        />
      );
    })()
  ),
  del: ({ children, ...props }) => (
    <del className="text-muted-foreground line-through" {...props}>
      {children}
    </del>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
};

export interface MarkdownRendererProps {
  content: string;
  appends?: Append[];
  highlightAppend?: string;
  className?: string;
  /** Use 'reader' for document-focused experience in capability views */
  variant?: 'default' | 'reader';
}

export function MarkdownRenderer({
  content,
  appends,
  className,
  variant = 'default',
}: MarkdownRendererProps) {
  const processedContent = useMemo(() => {
    const withoutFrontmatter = stripLeadingFrontmatter(content);
    if (!appends || appends.length === 0) {
      return withoutFrontmatter;
    }

    const appendPattern = /<!--\s*append\s+id:(\w+)[^>]*-->/g;
    
    return withoutFrontmatter.replace(appendPattern, (_match, appendId) => {
      const append = appends.find((a) => a.id === appendId);
      if (!append) return '';

      return `\n---\n`;
    });
  }, [content, appends]);

  return (
    <div className={cn(
      'markdown-renderer',
      variant === 'reader' && 'prose-reader',
      className
    )}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={MARKDOWN_COMPONENTS}
      >
        {processedContent}
      </Markdown>
    </div>
  );
}
