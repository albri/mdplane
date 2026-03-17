/// <reference types="bun-types" />

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'bun:test'
import { parseGitHubAlertFromBlockquote } from './mdx-components'

describe('parseGitHubAlertFromBlockquote', () => {
  test('parses GitHub NOTE alert syntax and strips marker text', () => {
    const children = [
      React.createElement('p', { key: 'p' }, '[!NOTE]\nETag prevents conflicts between writers.'),
    ]

    const parsed = parseGitHubAlertFromBlockquote(children)

    expect(parsed?.type).toBe('NOTE')
    expect(renderToStaticMarkup(React.createElement(React.Fragment, {}, parsed?.children))).toContain(
      'ETag prevents conflicts between writers.'
    )
    expect(renderToStaticMarkup(React.createElement(React.Fragment, {}, parsed?.children))).not.toContain('[!NOTE]')
  })

  test('returns null for regular blockquotes', () => {
    const children = [React.createElement('p', { key: 'p' }, 'Normal quoted text')]
    expect(parseGitHubAlertFromBlockquote(children)).toBeNull()
  })

  test('preserves inline markup after stripping alert marker', () => {
    const children = [
      React.createElement(
        'p',
        { key: 'p' },
        '[!TIP] ',
        React.createElement('strong', { key: 'strong' }, 'Use append keys'),
        ' for write-only integrations.'
      ),
    ]

    const parsed = parseGitHubAlertFromBlockquote(children)

    expect(parsed?.type).toBe('TIP')
    const html = renderToStaticMarkup(React.createElement(React.Fragment, {}, parsed?.children))
    expect(html).toContain('<strong>Use append keys</strong>')
    expect(html).not.toContain('[!TIP]')
  })
})
