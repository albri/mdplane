/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { stripLeadingFrontmatter } from './strip-frontmatter'

describe('stripLeadingFrontmatter', () => {
  test('removes leading YAML frontmatter block', () => {
    const input = `---
title: Personal Workflow Backlog
owner: demo
---

# Backlog
`
    expect(stripLeadingFrontmatter(input)).toBe('# Backlog\n')
  })

  test('keeps content when no frontmatter block is present', () => {
    const input = '# Backlog\n\ncontent'
    expect(stripLeadingFrontmatter(input)).toBe(input)
  })

  test('keeps content when opening block is not key-value frontmatter', () => {
    const input = `---
not frontmatter
---

# Backlog
`
    expect(stripLeadingFrontmatter(input)).toBe(input)
  })
})
