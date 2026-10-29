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

// Where the next match of `pattern` starts, at or after `from`. Openers are tried left to right,
// so searches only move forward and an answer stays good until they pass it. That keeps a body
// full of openers that never close, like 256 KB of `[`, to one read of the text.
function finder(text: string, search: RegExp): (from: number) => number {
  let start = Infinity
  let found = -1
  return (from) => {
    if (from >= start && (found === -1 || found >= from)) return found
    search.lastIndex = from
    found = search.exec(text)?.index ?? -1
    start = from
    return found
  }
}

// Global so that `lastIndex` sets where each search starts. Every search sets it first.
const TICK = /`/g
const STAR = /\*/g
const CLOSE = /]/g
const HREF_END = /[)\s]/g

const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c)

// `code`, **strong**, *em* and [label](href), matched as /`([^`]+)`|\*\*([^*]+)\*\*|
// \*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/ would, but in one pass. A regex retries the rest of
// the text from every unclosed opener, which is quadratic.
export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = []
  // Adjacent text joins up, so a refused link reads as the text around it.
  const addText = (part: string) => {
    const last = nodes.at(-1)
    if (last?.type === 'text') last.text += part
    else if (part) nodes.push({ type: 'text', text: part })
  }
  const tick = finder(text, TICK)
  const star = finder(text, STAR)
  const close = finder(text, CLOSE)
  const hrefEnd = finder(text, HREF_END)
  // Text from `plain` up to `i` hasn't been emitted yet.
  let plain = 0
  let i = 0
  const emit = (node: Inline, next: number) => {
    addText(text.slice(plain, i))
    nodes.push(node)
    i = plain = next
  }
  while (i < text.length) {
    const c = text[i]
    if (c === '`') {
      const end = tick(i + 1)
      if (end > i + 1) {
        emit({ type: 'code', text: text.slice(i + 1, end) }, end + 1)
        continue
      }
    } else if (c === '*' && text[i + 1] === '*') {
      const end = star(i + 2)
      if (end > i + 2 && text[end + 1] === '*') {
        emit({ type: 'strong', children: parseInline(text.slice(i + 2, end)) }, end + 2)
        continue
      }
    } else if (c === '*' && text[i + 1] !== undefined && !isSpace(text[i + 1])) {
      const end = star(i + 1)
      if (end !== -1) {
        emit({ type: 'em', children: parseInline(text.slice(i + 1, end)) }, end + 1)
        continue
      }
    } else if (c === '[') {
      const labelEnd = close(i + 1)
      const end = labelEnd > i + 1 && text[labelEnd + 1] === '(' ? hrefEnd(labelEnd + 2) : -1
      if (end > labelEnd + 2 && text[end] === ')') {
        const href = text.slice(labelEnd + 2, end)
        if (isSafeHref(href)) {
          emit({ type: 'link', href, children: parseInline(text.slice(i + 1, labelEnd)) }, end + 1)
        } else {
          // A refused link stays text, label and all.
          i = end + 1
        }
        continue
      }
    }
    i++
  }
  addText(text.slice(plain))
  return nodes
}

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const RULE = /^(-{3,}|\*{3,})\s*$/
const FENCE = '```'

// Quotes nest by recursion, so a line of thousands of `>` would overflow the stack. Deeper ones
// read as text.
const MAX_QUOTE_DEPTH = 8

const startsBlock = (line: string) =>
  line.startsWith(FENCE) ||
  line.startsWith('>') ||
  HEADING.test(line) ||
  BULLET.test(line) ||
  NUMBERED.test(line)

export function parse(source: string, depth = 0): Block[] {
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
    } else if (line.startsWith('>') && depth < MAX_QUOTE_DEPTH) {
      const quoted = take((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, ''))
      blocks.push({ type: 'quote', children: parse(quoted.join('\n'), depth + 1) })
    } else if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      i++
    } else {
      // The first line is taken whatever it starts with, so a quote too deep to nest still moves on.
      i++
      const text = [line, ...take((l) => l.trim() !== '' && !startsBlock(l))].join(' ')
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

// Parsed bodies by content hash. A reader redraws on every step through the history, and the
// body it shows changes far less often than that.
const parsed = new Map<string, Block[]>()
const PARSED_MAX = 32

function parseCached(source: string, key: string | undefined): Block[] {
  if (key === undefined) return parse(source)
  const hit = parsed.get(key)
  if (hit) {
    // Most recently used goes last, so the first key is the one to drop.
    parsed.delete(key)
    parsed.set(key, hit)
    return hit
  }
  const blocks = parse(source)
  parsed.set(key, blocks)
  if (parsed.size > PARSED_MAX) parsed.delete(parsed.keys().next().value ?? key)
  return blocks
}

// `key` names the source, such as a write's content hash, so the same body isn't parsed twice.
export const markdown = (source: string, level = 1, key?: string): TemplateResult[] =>
  parseCached(source, key).map((node) => block(node, level))
