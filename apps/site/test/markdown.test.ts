import { describe, expect, test } from 'vitest'
import { parse, parseInline } from '../src/markdown.ts'

const text = (t: string) => [{ type: 'text', text: t }]

// Anyone with an append or write link writes text that other links' holders read. The renderer only
// ever makes markup from these nodes, and lit-html escapes every string in them, so the parser is
// where the rules live.
describe('the markdown parser', () => {
  test('keeps HTML as text', () => {
    expect(parse('<script>alert(1)</script> <img src=x onerror=alert(1)>')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '<script>alert(1)</script> <img src=x onerror=alert(1)>' },
        ],
      },
    ])
  })

  test('only links to http, https and same-site targets', () => {
    for (const href of ['https://example.com/a?b=1&c=2', 'http://example.com', '/r/x', '#tasks']) {
      expect(parseInline(`[x](${href})`)).toEqual([
        { type: 'link', href, children: [{ type: 'text', text: 'x' }] },
      ])
    }
    for (const href of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,x',
      'vbscript:x',
      '//evil.example',
      '/\\evil.example',
      '&#106;avascript:alert(1)',
    ]) {
      expect(parseInline(`[x](${href})`)).toEqual([{ type: 'text', text: `[x](${href})` }])
    }
  })

  test('keeps code spans literal', () => {
    expect(parseInline('`**not bold**` and **bold** and *em*')).toEqual([
      { type: 'code', text: '**not bold**' },
      { type: 'text', text: ' and ' },
      { type: 'strong', children: [{ type: 'text', text: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'em', children: [{ type: 'text', text: 'em' }] },
    ])
  })

  // A body can be 256 KB, and the reader parses it on the main thread. Openers that never close
  // used to cost a scan of the rest of the text each, which froze the page for over a minute.
  test('parses a hostile 256 KB body in linear time', () => {
    const size = 256 * 1024
    // Quadratic took over a minute; linear takes a few milliseconds.
    const slow = ['[', '[a', '[a](', '[a](/', '`', '>'].filter((opener) => {
      const started = performance.now()
      parse(opener.repeat(Math.floor(size / opener.length)))
      return performance.now() - started > 500
    })
    expect(slow).toEqual([])
  })

  test('reads quotes too deep to nest as text', () => {
    const blocks = parse('>'.repeat(20))
    let depth = 0
    let node = blocks[0]
    while (node?.type === 'quote') {
      depth++
      node = node.children[0]
    }
    expect(depth).toBe(8)
    expect(node).toEqual({ type: 'paragraph', children: text('>'.repeat(12)) })
  })

  test('reads unclosed and refused markup as the text it is', () => {
    expect(parseInline('[a] [b](/x) **c `e')).toEqual([
      { type: 'text', text: '[a] ' },
      { type: 'link', href: '/x', children: text('b') },
      { type: 'text', text: ' **c `e' },
    ])
    expect(parseInline('[x](javascript:y) [z](/ok)')).toEqual([
      { type: 'text', text: '[x](javascript:y) ' },
      { type: 'link', href: '/ok', children: text('z') },
    ])
  })

  test('reads the structures briefs use', () => {
    expect(
      parse(
        '# Title\n## Rules\n\nIntro\nwraps.\n\n- one\n- two\n\n1. first\n\n```\ncode <x>\n```\n\n> quoted\n\n---',
      ),
    ).toEqual([
      { type: 'heading', depth: 1, children: text('Title') },
      { type: 'heading', depth: 2, children: text('Rules') },
      { type: 'paragraph', children: text('Intro wraps.') },
      { type: 'list', ordered: false, items: [text('one'), text('two')] },
      { type: 'list', ordered: true, items: [text('first')] },
      { type: 'code', text: 'code <x>' },
      { type: 'quote', children: [{ type: 'paragraph', children: text('quoted') }] },
      { type: 'rule' },
    ])
  })
})
