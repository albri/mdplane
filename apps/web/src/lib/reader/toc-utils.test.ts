/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { extractTocFromMarkdown } from './toc-utils'

describe('extractTocFromMarkdown', () => {
  test('extracts headings with depth and slug URL', () => {
    const content = `# Getting Started\n\n## Install\n\n### Run`
    expect(extractTocFromMarkdown(content)).toEqual([
      { title: 'Getting Started', url: '#getting-started', depth: 1 },
      { title: 'Install', url: '#install', depth: 2 },
      { title: 'Run', url: '#run', depth: 3 },
    ])
  })

  test('ignores headings inside fenced code blocks', () => {
    const content = [
      '# Real heading',
      '',
      '```bash',
      '# this should not be in toc',
      '## nor this',
      '```',
      '',
      '## Also real',
      '',
      '~~~md',
      '### hidden heading',
      '~~~',
      '',
      '### Final heading',
    ].join('\n')

    expect(extractTocFromMarkdown(content)).toEqual([
      { title: 'Real heading', url: '#real-heading', depth: 1 },
      { title: 'Also real', url: '#also-real', depth: 2 },
      { title: 'Final heading', url: '#final-heading', depth: 3 },
    ])
  })
})
