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

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export const esc = (text: unknown) => String(text).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

export const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function clock(timeZone?: string) {
  const format = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })
  return (time: number | string) => format.format(new Date(time))
}

// Scrolls a panel just enough to show an element, keeping its top edge visible.
export function revealIn(box: HTMLElement, el: HTMLElement, topInset = 0): void {
  if (box.scrollHeight <= box.clientHeight + 1) return
  const b = box.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const top = b.top + topInset + 8
  const bottom = b.bottom - 8
  let dy = 0
  if (r.top < top) dy = r.top - top
  else if (r.bottom > bottom) dy = Math.min(r.bottom - bottom, r.top - top)
  if (dy) box.scrollBy({ top: dy, behavior: motionOK() ? 'smooth' : 'auto' })
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

export function copyText(button: HTMLButtonElement, text: string, source: HTMLElement): void {
  const label = button.textContent
  const done = (message: string) => {
    button.textContent = message
    window.setTimeout(() => {
      button.textContent = label
    }, 1600)
  }
  const select = () => {
    const range = document.createRange()
    range.selectNodeContents(source)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    done('Selected. Copy it now')
  }
  if (!('clipboard' in navigator)) {
    select()
    return
  }
  navigator.clipboard.writeText(text).then(() => done('Copied'), select)
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
