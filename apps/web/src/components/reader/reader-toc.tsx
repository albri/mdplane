'use client'

import type { ComponentProps, ReactNode, RefObject } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import scrollIntoView from 'scroll-into-view-if-needed'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@mdplane/ui/lib/utils'
import { ChevronDown, TextAlignStart } from 'lucide-react'

export interface TocItem {
  title: string
  url: string
  depth: number
}

interface ReaderTocBaseProps {
  items: TocItem[]
  className?: string
}

function useActiveAnchors(items: TocItem[], single = false): string[] {
  const watch = useMemo(() => items.map((item) => item.url.slice(1)), [items])
  const observerRef = useRef<IntersectionObserver | null>(null)
  const stateRef = useRef<{ visible: Set<string> }>({ visible: new Set() })
  const [activeAnchors, setActiveAnchors] = useState<string[]>([])

  useEffect(() => {
    if (observerRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const state = stateRef.current
        for (const entry of entries) {
          if (entry.isIntersecting) {
            state.visible.add(entry.target.id)
          } else {
            state.visible.delete(entry.target.id)
          }
        }

        if (state.visible.size === 0) {
          const viewTop = entries[0]?.rootBounds?.top ?? 0
          let fallback: Element | null = null
          let min = -1

          for (const id of watch) {
            const element = document.getElementById(id)
            if (!element) continue

            const distance = Math.abs(viewTop - element.getBoundingClientRect().top)
            if (min === -1 || distance < min) {
              fallback = element
              min = distance
            }
          }

          setActiveAnchors(fallback ? [fallback.id] : [])
          return
        }

        const visibleItems = watch.filter((item) => state.visible.has(item))
        setActiveAnchors(single ? visibleItems.slice(0, 1) : visibleItems)
      },
      { rootMargin: '0px', threshold: 0.98 }
    )

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [single, watch])

  useEffect(() => {
    const observer = observerRef.current
    if (!observer) return

    const elements = watch.flatMap((heading) => document.getElementById(heading) ?? [])
    for (const element of elements) {
      observer.observe(element)
    }

    return () => {
      for (const element of elements) {
        observer.unobserve(element)
      }
    }
  }, [watch])

  return activeAnchors
}

function calcThumb(container: HTMLElement, active: string[]): [number, number] {
  if (active.length === 0 || container.clientHeight === 0) return [0, 0]

  let upper = Number.MAX_VALUE
  let lower = 0

  for (const item of active) {
    const element = container.querySelector<HTMLElement>(`a[href="#${item}"]`)
    if (!element) continue

    const styles = getComputedStyle(element)
    upper = Math.min(upper, element.offsetTop + Number.parseFloat(styles.paddingTop))
    lower = Math.max(lower, element.offsetTop + element.clientHeight - Number.parseFloat(styles.paddingBottom))
  }

  if (upper === Number.MAX_VALUE) return [0, 0]
  return [upper, lower - upper]
}

function TocThumb({
  active,
  containerRef,
  className,
}: {
  active: string[]
  containerRef: RefObject<HTMLElement | null>
  className?: string
}) {
  const thumbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const thumb = thumbRef.current
    if (!container || !thumb) return

    const update = () => {
      const [top, height] = calcThumb(container, active)
      thumb.style.setProperty('--toc-top', `${top}px`)
      thumb.style.setProperty('--toc-height', `${height}px`)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [active, containerRef])

  return <div ref={thumbRef} data-hidden={active.length === 0} className={className} />
}

function getItemOffset(depth: number): number {
  if (depth <= 2) return 14
  if (depth === 3) return 26
  return 36
}

function getLineOffset(depth: number): number {
  return depth >= 3 ? 10 : 0
}

function TocItemLink({
  item,
  active,
  containerRef,
  onNavigate,
  upperDepth = item.depth,
  lowerDepth = item.depth,
}: {
  item: TocItem
  active: string[]
  containerRef: RefObject<HTMLDivElement | null>
  onNavigate?: () => void
  upperDepth?: number
  lowerDepth?: number
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const id = item.url.slice(1)
  const activeOrder = active.indexOf(id)
  const shouldScroll = activeOrder === 0
  const offset = getLineOffset(item.depth)
  const upperOffset = getLineOffset(upperDepth)
  const lowerOffset = getLineOffset(lowerDepth)

  useLayoutEffect(() => {
    const anchor = ref.current
    const container = containerRef.current
    if (!anchor || !container || !shouldScroll) return

    scrollIntoView(anchor, {
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
      scrollMode: 'always',
      boundary: container,
    })
  }, [containerRef, shouldScroll])

  return (
    <a
      ref={ref}
      href={item.url}
      data-active={activeOrder !== -1}
      style={{ paddingInlineStart: getItemOffset(item.depth) }}
      className={cn(
        'prose relative py-1.5 text-sm text-muted-foreground transition-colors wrap-anywhere first:pt-0 last:pb-0 data-[active=true]:text-primary'
      )}
      onClick={() => onNavigate?.()}
    >
      {offset !== upperOffset ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          className="absolute -top-1.5 start-0 size-4 rtl:-scale-x-100"
        >
          <line
            x1={upperOffset}
            y1="0"
            x2={offset}
            y2="12"
            className="stroke-foreground/10"
            strokeWidth="1"
          />
        </svg>
      ) : null}
      <div
        className={cn(
          'absolute inset-y-0 w-px bg-foreground/10',
          offset !== upperOffset && 'top-1.5',
          offset !== lowerOffset && 'bottom-1.5'
        )}
        style={{ insetInlineStart: offset }}
      />
      {item.title}
    </a>
  )
}

function TocItems({
  items,
  active,
  onNavigate,
}: {
  items: TocItem[]
  active: string[]
  onNavigate?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<{ path: string; width: number; height: number }>()

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    function onResize() {
      if (container.clientHeight === 0) return

      let width = 0
      let height = 0
      const path: string[] = []
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const element = container.querySelector<HTMLElement>(`a[href="#${item.url.slice(1)}"]`)
        if (!element) continue

        const styles = getComputedStyle(element)
        const offset = getLineOffset(item.depth) + 1
        const top = element.offsetTop + Number.parseFloat(styles.paddingTop)
        const bottom = element.offsetTop + element.clientHeight - Number.parseFloat(styles.paddingBottom)

        width = Math.max(offset, width)
        height = Math.max(height, bottom)
        path.push(`${index === 0 ? 'M' : 'L'}${offset} ${top}`)
        path.push(`L${offset} ${bottom}`)
      }

      setSvg({
        path: path.join(' '),
        width: width + 1,
        height,
      })
    }

    const observer = new ResizeObserver(onResize)
    onResize()
    observer.observe(container)
    return () => observer.disconnect()
  }, [items])

  return (
    <>
      {svg ? (
        <div
          data-testid="toc-depth-guide"
          className="absolute start-0 top-0 rtl:-scale-x-100"
          style={{
            width: svg.width,
            height: svg.height,
            maskImage: `url("data:image/svg+xml,${encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${svg.width} ${svg.height}'><path d='${svg.path}' stroke='black' stroke-width='1' fill='none' /></svg>`
            )}")`,
          }}
        >
          <TocThumb
            active={active}
            containerRef={containerRef}
            className="absolute top-[var(--toc-top)] h-[var(--toc-height)] w-full bg-primary transition-[top,height]"
          />
        </div>
      ) : null}
      <div ref={containerRef} className="flex flex-col">
        {items.map((item, index) => (
          <TocItemLink
            key={item.url}
            item={item}
            active={active}
            containerRef={containerRef}
            onNavigate={onNavigate}
            upperDepth={items[index - 1]?.depth}
            lowerDepth={items[index + 1]?.depth}
          />
        ))}
      </div>
    </>
  )
}

function TocScrollArea({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative min-h-0 overflow-auto py-3 text-sm [scrollbar-width:none] mask-[linear-gradient(to_bottom,transparent,white_16px,white_calc(100%-16px),transparent)]',
        className
      )}
    >
      {children}
    </div>
  )
}

interface ProgressCircleProps extends Omit<ComponentProps<'svg'>, 'strokeWidth'> {
  value: number
  strokeWidth?: number
  size?: number
  min?: number
  max?: number
}

function clamp(input: number, min: number, max: number): number {
  if (input < min) return min
  if (input > max) return max
  return input
}

function ProgressCircle({
  value,
  strokeWidth = 2,
  size = 24,
  min = 0,
  max = 100,
  ...props
}: ProgressCircleProps) {
  const normalizedValue = clamp(value, min, max)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (normalizedValue / max) * circumference

  return (
    <svg
      role="progressbar"
      viewBox={`0 0 ${size} ${size}`}
      aria-valuenow={normalizedValue}
      aria-valuemin={min}
      aria-valuemax={max}
      {...props}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-current/25"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all"
      />
    </svg>
  )
}

export function ReaderToc({ items, className }: ReaderTocBaseProps) {
  const active = useActiveAnchors(items)
  if (items.length === 0) return null

  return (
    <nav className={cn('flex min-h-0 flex-1 flex-col', className)} aria-label="Table of contents">
      <h3 id="toc-title" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <TextAlignStart className="size-4" />
        On this page
      </h3>
      <TocScrollArea className="ms-px">
        <TocItems items={items} active={active} />
      </TocScrollArea>
    </nav>
  )
}

export function ReaderTocPopover({ items, className }: ReaderTocBaseProps) {
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const active = useActiveAnchors(items)

  const selectedIndex = useMemo(() => {
    if (active.length === 0) return -1
    return items.findIndex((item) => item.url.slice(1) === active[0])
  }, [active, items])

  const showSelectedHeading = selectedIndex !== -1 && !open

  useEffect(() => {
    if (!open) return

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (headerRef.current && !headerRef.current.contains(target)) {
        setOpen(false)
      }
    }

    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [open])

  if (items.length === 0) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-toc-popover=""
      className={cn(
        'sticky top-[var(--shell-row-2)] z-10 [grid-area:secondary-popover] h-[var(--shell-secondary-popover-height)] xl:hidden max-xl:[--shell-secondary-popover-height:2.5rem]',
        className
      )}
    >
      <header
        ref={headerRef}
        className={cn('border-b bg-background/80 backdrop-blur-sm transition-colors', open && 'shadow-lg')}
      >
        <CollapsibleTrigger
          data-toc-popover-trigger=""
          data-active={open}
          className="flex h-10 w-full items-center gap-2.5 rounded-md px-4 py-2.5 text-start text-sm text-muted-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&_svg]:size-4 md:px-6"
        >
          <ProgressCircle
            value={(selectedIndex + 1) / Math.max(1, items.length)}
            max={1}
            className={cn('shrink-0', open && 'text-primary')}
          />
          <span className="grid flex-1 *:col-start-1 *:row-start-1 *:my-auto">
            <span
              className={cn(
                'truncate transition-all',
                open && 'text-foreground',
                showSelectedHeading && 'pointer-events-none -translate-y-full opacity-0'
              )}
            >
              On this page
            </span>
            <span
              className={cn(
                'truncate transition-all',
                !showSelectedHeading && 'pointer-events-none translate-y-full opacity-0'
              )}
            >
              {items[selectedIndex]?.title}
            </span>
          </span>
          <ChevronDown className={cn('mx-0.5 shrink-0 transition-transform', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent
          data-toc-popover-content=""
          className="flex max-h-[50vh] flex-col px-4 md:px-6"
        >
          <div>
            <TocScrollArea>
              <TocItems items={items} active={active} onNavigate={() => setOpen(false)} />
            </TocScrollArea>
          </div>
        </CollapsibleContent>
      </header>
    </Collapsible>
  )
}

