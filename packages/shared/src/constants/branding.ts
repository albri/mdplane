/**
 * mdplane Branding Constants
 *
 * Shared branding assets used across landing page, web app, and CLI.
 */

/**
 * Application name (lowercase)
 * Use in page titles, meta descriptions, UI text.
 * When displayed standalone in UI (not part of a sentence), apply font-mono className.
 */
export const APP_NAME = 'mdplane';

export const BRAND_ACCENT_HEX = '#84cc16';
export const WORDMARK_MD_SPLIT_COL = 22;

export interface WordmarkLine {
  accent: string;
  base: string;
}

/**
 * ASCII art wordmark for mdplane
 * Used in landing page hero, web app splash screens, CLI help output
 *
 * @example
 * ```tsx
 * // React component
 * <pre className="font-mono text-[10px] leading-[10px]">{ASCII_WORDMARK}</pre>
 *
 * // CLI
 * console.log(ASCII_WORDMARK)
 * ```
 */
export const ASCII_WORDMARK = `                   888          888
                   888          888
                   888          888
88888b.d88b.   .d88888 88888b.  888  8888b.  88888b.   .d88b.
888 "888 "88b d88" 888 888 "88b 888     "88b 888 "88b d8P  Y8b
888  888  888 888  888 888  888 888 .d888888 888  888 88888888
888  888  888 Y88b 888 888 d88P 888 888  888 888  888 Y8b.
888  888  888  "Y88888 88888P"  888 "Y888888 888  888  "Y8888
                       888
                       888
                       888                                     `;

export function splitWordmarkLines(
  wordmark: string = ASCII_WORDMARK,
  splitCol: number = WORDMARK_MD_SPLIT_COL
): WordmarkLine[] {
  return wordmark.split('\n').map((line) => ({
    accent: line.slice(0, splitCol),
    base: line.slice(splitCol),
  }));
}

/**
 * Core proposition copy
 */
export const TAGLINE = 'The markdown coordination layer for agents.';
export const HERO_DESCRIPTION =
  'One readable timeline where agents claim tasks, post results, and hand off work. You see everything. They never duplicate work.';
