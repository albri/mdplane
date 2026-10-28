import { describe, expect, test } from 'vitest'
import { markdown } from '../src/markdown.ts'

// Anyone with an append or write link writes text that other links' holders read, so nothing in
// it may become markup the renderer didn't emit.
describe('the markdown renderer', () => {
  test('escapes HTML everywhere', () => {
    const html = markdown(
      '# <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n- **<b>bold</b>**\n\n`<i>`',
    )
    expect(html).not.toMatch(/<(img|script|b|i)\b/)
    expect(html).toContain('&lt;script&gt;')
  })

  test('only links to http, https and same-site targets', () => {
    expect(markdown('[ok](https://example.com/a?b=1&c=2)')).toContain(
      '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">ok</a>',
    )
    expect(markdown('[ok](/r/elsewhere)')).toContain('<a href="/r/elsewhere"')
    for (const target of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,x',
      '//evil.example',
      '/\\evil.example',
      '&#106;avascript:alert(1)',
    ]) {
      expect({ target, html: markdown(`[x](${target})`) }).not.toMatchObject({
        html: expect.stringContaining('<a '),
      })
    }
  })

  test('cannot break out of an attribute', () => {
    const html = markdown('[x](https://example.com/"onmouseover="alert(1))')
    expect(html).not.toMatch(/"\s*onmouseover=/)
  })

  test('keeps code spans literal', () => {
    expect(markdown('`**not bold**` and **bold**')).toBe(
      '<p><code>**not bold**</code> and <strong>bold</strong></p>',
    )
  })

  test('renders the structures briefs use', () => {
    const html = markdown(
      '# Title\n\nIntro\nwraps.\n\n- one\n- two\n\n1. first\n\n```\ncode <x>\n```\n\n> quoted',
    )
    expect(html).toBe(
      '<h3 class="md-h md-h1">Title</h3><p>Intro wraps.</p><ul><li>one</li><li>two</li></ul>' +
        '<ol><li>first</li></ol><pre class="md-code"><code>code &lt;x&gt;</code></pre>' +
        '<blockquote><p>quoted</p></blockquote>',
    )
  })
})
