// FTS5's snippet() tokenises the whole of each document it quotes, which over a full workspace
// kept the object busy for seconds. Search ranks in SQL instead, and cuts each snippet here from
// no more than the opening of the text.

// What FTS5's unicode61 tokenizer counts as part of a word. Words made only of these need no
// escaping in a pattern.
const WORD = String.raw`\p{L}\p{N}\p{M}\p{Co}`
const SEPARATORS = new RegExp(`[^${WORD}]+`, 'u')

// Words either side of the first match, as FTS5 counts a snippet's length.
const BEFORE = 4
const WORDS = 16
// How far either side of the first match to look for those words.
const REACH = { before: 200, after: 400 }

// Finds the query's words where FTS5 would match them, ignoring case. FTS5 also ignores accents,
// so a word that matched only through them isn't found, and its snippet is the text's opening.
export function finder(q: string): RegExp | null {
  const words = [...new Set(q.split(SEPARATORS).filter(Boolean))]
  if (words.length === 0) return null
  return new RegExp(`(?<![${WORD}])(?:${words.join('|')})(?![${WORD}])`, 'giu')
}

const hasText = (text: string) => /\S/.test(text)

// Up to 16 words from just before the first match, with every match marked `**` and `…` where
// the text goes on, the way snippet() wrote them.
export function snippet(text: string, find: RegExp | null): string {
  let at = 0
  if (find) {
    find.lastIndex = 0
    at = find.exec(text)?.index ?? 0
  }
  const from = Math.max(0, at - REACH.before)
  const to = at + REACH.after
  const near = text.slice(from, to)
  let words = [...near.matchAll(/\S+/g)]
  // A word cut by the edge of what was looked at isn't whole, so it could be marked wrongly.
  if (from > 0 && words[0]?.index === 0 && hasText(text.charAt(from - 1))) words = words.slice(1)
  const last = words.at(-1)
  if (last && last.index + last[0].length === near.length && hasText(text.charAt(to))) {
    words = words.slice(0, -1)
  }
  const hit = Math.max(
    0,
    words.findIndex((word) => from + word.index + word[0].length > at),
  )
  const shown = words.slice(Math.max(0, hit - BEFORE)).slice(0, WORDS)
  const head = shown[0]
  const tail = shown.at(-1)
  // Without a whole word, as in a long run with no spaces, the snippet is what was looked at.
  const start = head ? from + head.index : from
  const end = tail ? from + tail.index + tail[0].length : Math.min(text.length, to)
  const cut = text.slice(start, end)
  const marked = find ? cut.replace(find, '**$&**') : cut
  return `${hasText(text.slice(0, start)) ? '…' : ''}${marked}${hasText(text.slice(end)) ? '…' : ''}`
}
