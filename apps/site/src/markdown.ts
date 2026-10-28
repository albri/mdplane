// A small markdown renderer for file bodies. Anyone with an append or write link can write the
// text a reader shows, so everything is escaped first and the only markup is what this emits.
// Links keep only http(s) and relative targets.
import { esc } from './dom.ts'

function inline(text: string): string {
  // Code spans are set aside behind private-use markers so the other rules can't touch them.
  const codes: string[] = []
  let out = esc(text).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`)
    return `\uE000${codes.length - 1}\uE000`
  })
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
      const target = href.replaceAll('&amp;', '&')
      // `//` and `/\` are protocol-relative in browsers, so they could point anywhere.
      const safe = /^(https?:\/\/|\/|#)/i.test(target) && !/^\/[/\\]/.test(target)
      return safe ? `<a href="${href}" rel="noopener noreferrer">${label}</a>` : match
    })
  return out.replace(/\uE000(\d+)\uE000/g, (_, i: string) => codes[Number(i)] ?? '')
}

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

export function markdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  const take = (test: (line: string) => boolean) => {
    const block: string[] = []
    while (i < lines.length && test(lines[i] ?? '')) block.push(lines[i++] ?? '')
    return block
  }
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.trim() === '') {
      i++
    } else if (line.startsWith('```')) {
      i++
      const code = take((l) => !l.startsWith('```'))
      i++
      out.push(`<pre class="md-code"><code>${esc(code.join('\n'))}</code></pre>`)
    } else if (HEADING.test(line)) {
      const [, hashes = '#', text = ''] = HEADING.exec(line) ?? []
      // A body's headings sit inside the reader's own, so they start one level down.
      const level = Math.min(hashes.length + 2, 6)
      out.push(`<h${level} class="md-h md-h${hashes.length}">${inline(text)}</h${level}>`)
      i++
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line)
      const pattern = ordered ? NUMBERED : BULLET
      const items = take((l) => pattern.test(l)).map(
        (l) => `<li>${inline(pattern.exec(l)?.[1] ?? '')}</li>`,
      )
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
    } else if (line.startsWith('>')) {
      const quote = take((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, ''))
      out.push(`<blockquote>${markdown(quote.join('\n'))}</blockquote>`)
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr>')
      i++
    } else {
      const para = take(
        (l) =>
          l.trim() !== '' &&
          !l.startsWith('```') &&
          !HEADING.test(l) &&
          !BULLET.test(l) &&
          !NUMBERED.test(l) &&
          !l.startsWith('>'),
      )
      out.push(`<p>${para.map(inline).join(' ')}</p>`)
    }
  }
  return out.join('')
}
