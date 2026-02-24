const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/
const FRONTMATTER_KEY_VALUE = /^[ \t]*[A-Za-z0-9_-]+:\s*.*$/m

/**
 * Removes leading YAML frontmatter from markdown before rendering.
 * Keeps content unchanged when the opening block is not valid key-value metadata.
 */
export function stripLeadingFrontmatter(content: string): string {
  const match = content.match(FRONTMATTER_BLOCK)
  if (!match) return content
  if (!FRONTMATTER_KEY_VALUE.test(match[1])) return content
  const withoutFrontmatter = content.slice(match[0].length)
  return withoutFrontmatter.replace(/^\r?\n/, '')
}
