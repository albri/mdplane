import { nothing, type TemplateResult } from 'lit-html'
import {
  Directive,
  directive,
  type ElementPart,
  PartType,
  type PartInfo,
} from 'lit-html/directive.js'
import { html as staticHtml, literal } from 'lit-html/static.js'

// Element lookups check the element's type at runtime instead of asserting it.
export function $as<T extends Element>(
  type: abstract new () => T,
  selector: string,
  root: ParentNode = document,
): T {
  const found = root.querySelector(selector)
  if (!(found instanceof type)) throw new Error(`Missing ${type.name} ${selector}`)
  return found
}

export const $ = (selector: string, root: ParentNode = document) => $as(HTMLElement, selector, root)

export const $$ = (selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(selector)).filter((el) => el instanceof HTMLElement)

export const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const scrollBehavior = (): ScrollBehavior => (motionOK() ? 'smooth' : 'instant')

export function clock(timeZone?: string) {
  const format = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
  return (time: number | string) => format.format(new Date(time))
}

export function dateTime(timeZone?: string) {
  const format = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
  return (time: number | string) => format.format(new Date(time))
}

const HEADINGS = [literal`h1`, literal`h2`, literal`h3`, literal`h4`, literal`h5`, literal`h6`]

// A heading at a level chosen at runtime, so a component's outline can nest inside any page's.
export function heading(
  level: number,
  content: unknown,
  { id, className }: { id?: string; className?: string } = {},
): TemplateResult {
  const tag = HEADINGS[Math.min(Math.max(level, 1), 6) - 1] ?? literal`h6`
  return staticHtml`<${tag} id=${id ?? nothing} class=${className ?? nothing}>${content}</${tag}>`
}

class CssProps extends Directive {
  constructor(part: PartInfo) {
    super(part)
    if (part.type !== PartType.ELEMENT) throw new Error('cssProps() goes on an element')
  }
  render(_props: Record<`--${string}`, string>) {
    return nothing
  }
  override update(part: ElementPart, [props]: [Record<`--${string}`, string>]) {
    if (part.element instanceof HTMLElement) {
      for (const [name, value] of Object.entries(props)) part.element.style.setProperty(name, value)
    }
    return nothing
  }
}

// Sets custom properties through the CSSOM, which the content security policy allows. lit-html's
// styleMap() writes a style attribute on first render, and the policy blocks inline styles.
export const cssProps = directive(CssProps)

const EDGE = 12

// Scrolls a panel the least it can to show `target`, and `from` above it when both fit. Content
// coordinates are used throughout, so a smooth scroll already under way doesn't skew the result.
export function reveal(
  box: HTMLElement,
  target: Element,
  {
    from = target,
    inset = 0,
    behavior = 'instant',
  }: { from?: Element; inset?: number; behavior?: ScrollBehavior } = {},
): void {
  if (box.scrollHeight <= box.clientHeight) return
  const origin = box.getBoundingClientRect().top - box.scrollTop
  const y = (el: Element, edge: 'top' | 'bottom') => el.getBoundingClientRect()[edge] - origin
  const viewTop = box.scrollTop + inset + EDGE
  const viewBottom = box.scrollTop + box.clientHeight - EDGE
  // Scroll down only as far as keeps the start of the span in view.
  const show = (start: number, end: number) => {
    if (start < viewTop) return start - inset - EDGE
    if (end > viewBottom) return box.scrollTop + Math.min(end - viewBottom, start - viewTop)
    return box.scrollTop
  }
  const start = y(target, 'top')
  const end = y(target, 'bottom')
  const context = Math.min(y(from, 'top'), start)
  const top = end - context <= viewBottom - viewTop ? show(context, end) : show(start, end)
  if (Math.abs(top - box.scrollTop) >= 1) box.scrollTo({ top, behavior })
}

const THEMES = ['system', 'light', 'dark'] as const
type Theme = (typeof THEMES)[number]

export function initTheme(): void {
  const button = $('#theme-btn')
  const label = $('#theme-label')
  let theme: Theme = 'system'
  try {
    theme = THEMES.find((t) => t === localStorage.getItem('mdplane-theme')) ?? 'system'
  } catch {
    // Storage can be unavailable; the system theme still works.
  }
  const apply = (next: Theme) => {
    theme = next
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    const name = theme.charAt(0).toUpperCase() + theme.slice(1)
    label.textContent = name
    button.setAttribute('aria-label', `Colour theme: ${name}. Change theme`)
  }
  apply(theme)
  button.addEventListener('click', () => {
    apply(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system')
    try {
      localStorage.setItem('mdplane-theme', theme)
    } catch {
      // Not remembered, which is fine.
    }
  })
}

// Whether the text reached the clipboard. A browser can refuse, so callers need a fallback.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function initTabs(): void {
  for (const list of $$('[role="tablist"]')) {
    const tabs = $$('[role="tab"]', list).filter((t) => t instanceof HTMLButtonElement)
    const select = (tab: HTMLButtonElement, focus: boolean) => {
      for (const t of tabs) {
        const on = t === tab
        t.setAttribute('aria-selected', String(on))
        t.tabIndex = on ? 0 : -1
        const panel = document.getElementById(t.getAttribute('aria-controls') ?? '')
        if (panel) panel.hidden = !on
      }
      if (focus) tab.focus()
    }
    for (const tab of tabs) tab.addEventListener('click', () => select(tab, false))
    list.addEventListener('keydown', (event) => {
      const i = tabs.findIndex((t) => t === document.activeElement)
      if (i < 0) return
      const next = {
        ArrowRight: (i + 1) % tabs.length,
        ArrowLeft: (i - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      }[event.key]
      const tab = next === undefined ? undefined : tabs[next]
      if (!tab) return
      event.preventDefault()
      select(tab, true)
    })
  }
}

// Whether a key press belongs to the focused control rather than to a page shortcut.
export function ownsKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.matches('input, select, textarea') ||
    target.closest('[role="tablist"], [role="group"], [role="dialog"], dialog') !== null
  )
}
