/**
 * Table of Contents Utilities
 *
 * Extracts heading information from markdown for TOC generation.
 */

export interface TocItem {
  title: string
  url: string
  depth: number
}

export function extractTocFromMarkdown(content: string): TocItem[] {
  const items: TocItem[] = []
  const lines = content.split(/\r?\n/)

  let inFence = false
  let fenceChar: '`' | '~' | null = null
  let fenceLength = 0
  let inHtmlCodeBlock = false

  for (const line of lines) {
    if (/<pre[\s>]|<code[\s>]/i.test(line)) {
      inHtmlCodeBlock = true
    }
    if (inHtmlCodeBlock && /<\/pre>|<\/code>/i.test(line)) {
      inHtmlCodeBlock = false
      continue
    }

    if (/^\t/.test(line) || /^ {4,}/.test(line)) continue
    if (inHtmlCodeBlock) continue

    const trimmed = line.trimStart()
    const fenceStartMatch = trimmed.match(/^([`~]{3,})/)

    if (fenceStartMatch) {
      const marker = fenceStartMatch[1]
      const currentFenceChar = marker[0] as '`' | '~'
      const currentFenceLength = marker.length

      if (!inFence) {
        inFence = true
        fenceChar = currentFenceChar
        fenceLength = currentFenceLength
        continue
      }

      if (fenceChar === currentFenceChar && currentFenceLength >= fenceLength) {
        inFence = false
        fenceChar = null
        fenceLength = 0
        continue
      }
    }

    if (inFence) continue

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!headingMatch) continue

    const depth = headingMatch[1].length
    const title = headingMatch[2].trim()
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    items.push({
      title,
      url: `#${slug}`,
      depth,
    })
  }

  return items
}

