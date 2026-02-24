import {
  bundledLanguages,
  bundledThemes,
  createHighlighter,
  createJavaScriptRegexEngine,
  type BundledLanguage,
  type BundledTheme,
  type HighlighterGeneric,
} from 'shiki'

type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>

export interface ShikiThemePair {
  light: BundledTheme
  dark: BundledTheme
}

export interface ShikiHighlightOptions {
  language?: string
  themes?: Partial<ShikiThemePair>
}

export const DEFAULT_THEMES: ShikiThemePair = {
  light: 'github-light',
  dark: 'github-dark',
}

export const SUPPORTED_LANGUAGES = Object.keys(bundledLanguages) as BundledLanguage[]
export const SUPPORTED_THEMES = Object.keys(bundledThemes) as BundledTheme[]

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  })

  return highlighterPromise
}

function normalizeLanguage(language: string | undefined): string {
  if (language == null) return 'text'

  const normalized = language
    .trim()
    .toLowerCase()
    .replace(/^language-/, '')

  if (!normalized) return 'text'
  if (normalized === 'shell') return 'bash'
  if (normalized === 'powershell') return 'powershell'
  if (normalized === 'ps1') return 'powershell'
  if (normalized === 'plaintext') return 'text'
  return normalized
}

function getThemes(themes?: Partial<ShikiThemePair>): ShikiThemePair {
  const light = themes?.light ?? DEFAULT_THEMES.light
  const dark = themes?.dark ?? DEFAULT_THEMES.dark
  return { light, dark }
}

async function loadMissingTheme(highlighter: Highlighter, theme: BundledTheme): Promise<void> {
  const { isSpecialTheme } = await import('shiki/core')

  if (isSpecialTheme(theme)) return

  try {
    highlighter.getTheme(theme)
  } catch {
    await highlighter.loadTheme(theme)
  }
}

async function loadMissingLanguage(highlighter: Highlighter, language: BundledLanguage): Promise<void> {
  const { isSpecialLang } = await import('shiki/core')

  if (isSpecialLang(language)) return

  try {
    highlighter.getLanguage(language)
  } catch {
    await highlighter.loadLanguage(language)
  }
}

function extractCodeInnerHtml(blockHtml: string): string {
  const codePattern = /<code[^>]*>([\s\S]*?)<\/code>/i
  const codeMatch = codePattern.exec(blockHtml)
  if (codeMatch?.[1] == null) return ''
  return codeMatch[1]
}

function stripSingleLineWrapper(innerHtml: string): string {
  const singleLinePattern = /^<span class="line">([\s\S]*)<\/span>$/
  const singleLine = singleLinePattern.exec(innerHtml)
  if (singleLine?.[1] == null) return innerHtml
  return singleLine[1]
}

export async function highlightCodeBlockHtml(code: string, options: ShikiHighlightOptions = {}): Promise<string> {
  const highlighter = await getHighlighter()
  let lang = normalizeLanguage(options.language)
  let themes = getThemes(options.themes)
  const themeMap: Record<string, BundledTheme> = {
    light: themes.light,
    dark: themes.dark,
  }

  try {
    await Promise.all([
      loadMissingTheme(highlighter, themes.light),
      loadMissingTheme(highlighter, themes.dark),
    ])
  } catch {
    themes = DEFAULT_THEMES
    themeMap.light = themes.light
    themeMap.dark = themes.dark
    await Promise.all([
      loadMissingTheme(highlighter, themes.light),
      loadMissingTheme(highlighter, themes.dark),
    ])
  }

  try {
    await loadMissingLanguage(highlighter, lang as BundledLanguage)
  } catch {
    lang = 'text'
    await loadMissingLanguage(highlighter, lang as BundledLanguage)
  }

  return highlighter.codeToHtml(code, {
    lang: lang as BundledLanguage,
    themes: themeMap,
    defaultColor: false,
  })
}

export async function highlightCodeInlineHtml(code: string, options: ShikiHighlightOptions = {}): Promise<string> {
  const blockHtml = await highlightCodeBlockHtml(code, options)
  return stripSingleLineWrapper(extractCodeInnerHtml(blockHtml))
}
