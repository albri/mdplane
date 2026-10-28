// A small markdown reader for file bodies. Anyone with an append or write link can write the text a
// reader shows, so the text is parsed into a few node types and rendered with lit-html, which
// escapes every string. Nothing is ever parsed as HTML, and links keep only safe targets.
import { html, type TemplateResult } from 'lit-html'
import { heading } from './dom.ts'

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }

export type Block =
  | { type: 'heading'; depth: number; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Block[] }
  | { type: 'code'; text: string }
  | { type: 'rule' }

// http(s), root-relative and fragment links only. `//` and `/\` are protocol-relative in
// browsers, so they could point anywhere.
export const isSafeHref = (href: string) =>
  /^(https?:\/\/|\/|#)/i.test(href) && !/^\/[/\\]/.test(href)

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/g

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = []
  // Adjacent text joins up, so a refused link reads as the text around it.
  const addText = (part: string) => {
    const last = nodes.at(-1)
    if (last?.type === 'text') last.text += part
    else if (part) nodes.push({ type: 'text', text: part })
  }
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const [whole, code, strong, em, label, href] = match
    addText(text.slice(last, match.index))
    if (code !== undefined) nodes.push({ type: 'code', text: code })
    else if (strong !== undefined) nodes.push({ type: 'strong', children: parseInline(strong) })
    else if (em !== undefined) nodes.push({ type: 'em', children: parseInline(em) })
    else if (label !== undefined && href !== undefined && isSafeHref(href))
      nodes.push({ type: 'link', href, children: parseInline(label) })
    else addText(whole)
    last = match.index + whole.length
  }
  addText(text.slice(last))
  return nodes
}

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const RULE = /^(-{3,}|\*{3,})\s*$/
const FENCE = '```'

const startsBlock = (line: string) =>
  line.startsWith(FENCE) ||
  line.startsWith('>') ||
  HEADING.test(line) ||
  BULLET.test(line) ||
  NUMBERED.test(line)

export function parse(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  const take = (test: (line: string) => boolean) => {
    const run: string[] = []
    while (i < lines.length && test(lines[i] ?? '')) run.push(lines[i++] ?? '')
    return run
  }
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const title = HEADING.exec(line)
    if (line.trim() === '') {
      i++
    } else if (line.startsWith(FENCE)) {
      i++
      blocks.push({ type: 'code', text: take((l) => !l.startsWith(FENCE)).join('\n') })
      i++
    } else if (title) {
      blocks.push({
        type: 'heading',
        depth: title[1]?.length ?? 1,
        children: parseInline(title[2] ?? ''),
      })
      i++
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line)
      const pattern = ordered ? NUMBERED : BULLET
      const items = take((l) => pattern.test(l)).map((l) => parseInline(pattern.exec(l)?.[1] ?? ''))
      blocks.push({ type: 'list', ordered, items })
    } else if (line.startsWith('>')) {
      const quoted = take((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, ''))
      blocks.push({ type: 'quote', children: parse(quoted.join('\n')) })
    } else if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      i++
    } else {
      const text = take((l) => l.trim() !== '' && !startsBlock(l)).join(' ')
      blocks.push({ type: 'paragraph', children: parseInline(text) })
    }
  }
  return blocks
}

const inline = (nodes: Inline[]): TemplateResult[] =>
  nodes.map((node) => {
    switch (node.type) {
      case 'text':
        return html`${node.text}`
      case 'code':
        return html`<code>${node.text}</code>`
      case 'strong':
        return html`<strong>${inline(node.children)}</strong>`
      case 'em':
        return html`<em>${inline(node.children)}</em>`
      case 'link':
        return html`<a href=${node.href} rel="noopener noreferrer">${inline(node.children)}</a>`
    }
  })

// `level` is the heading level a body's top heading takes, so its outline sits inside the page's.
function block(node: Block, level: number): TemplateResult {
  switch (node.type) {
    case 'heading':
      return heading(level + node.depth - 1, inline(node.children), {
        className: `md-h md-h${node.depth}`,
      })
    case 'paragraph':
      return html`<p>${inline(node.children)}</p>`
    case 'list': {
      const items = node.items.map((item) => html`<li>${inline(item)}</li>`)
      return node.ordered
        ? html`<ol>
            ${items}
          </ol>`
        : html`<ul>
            ${items}
          </ul>`
    }
    case 'quote':
      return html`<blockquote>${node.children.map((child) => block(child, level))}</blockquote>`
    case 'code':
      return html`<pre class="md-code"><code>${node.text}</code></pre>`
    case 'rule':
      return html`<hr />`
  }
}

export const markdown = (source: string, level = 1): TemplateResult[] =>
  parse(source).map((node) => block(node, level))
