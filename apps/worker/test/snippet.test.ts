import { describe, expect, test } from 'vitest'
import { finder, snippet } from '../src/snippet.ts'

const cut = (text: string, q: string) => snippet(text, finder(q))

describe('a search snippet', () => {
  test('marks every match of any query word, ignoring case', () => {
    expect(cut('CI is green on Node 22. Two workflow files changed.', 'node 22')).toBe(
      'CI is green on **Node** **22**. Two workflow files changed.',
    )
  })

  test('marks whole words only, as FTS5 matches them', () => {
    expect(cut('One bowl, two owls, one owl.', 'owl')).toBe('…bowl, two owls, one **owl**.')
  })

  test('splits query words where FTS5 does, so quotes and dots are not searched for', () => {
    expect(cut('Ship on Thursday after node.js upgrades', '"thursday node.js')).toBe(
      'Ship on **Thursday** after **node**.**js** upgrades',
    )
  })

  test('starts a few words before the first match and says where the text goes on', () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`)
    words[30] = 'lantern'
    expect(cut(words.join(' '), 'lantern')).toBe(
      `…w26 w27 w28 w29 **lantern** ${words.slice(31, 42).join(' ')}…`,
    )
  })

  test('falls back to the opening when the words are not found', () => {
    const words = Array.from({ length: 20 }, (_, i) => `w${i}`).join(' ')
    expect(cut(words, 'café')).toBe(`${words.split(' ').slice(0, 16).join(' ')}…`)
  })
})
