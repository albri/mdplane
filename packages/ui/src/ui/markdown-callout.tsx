import type { CSSProperties, HTMLAttributes } from 'react';
import {
  AlertTriangle,
  CircleX,
  Info,
  Lightbulb,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';

type MarkdownCalloutTone = 'note' | 'tip' | 'important' | 'warning' | 'caution';

interface MarkdownCalloutConfig {
  icon: LucideIcon;
  color: string;
}

const MARKDOWN_CALLOUT_CONFIG: Record<MarkdownCalloutTone, MarkdownCalloutConfig> = {
  note: {
    icon: Info,
    color: '#3b82f6',
  },
  tip: {
    icon: Lightbulb,
    color: '#22c55e',
  },
  important: {
    icon: ShieldAlert,
    color: '#5f86b0',
  },
  warning: {
    icon: AlertTriangle,
    color: '#f59e0b',
  },
  caution: {
    icon: CircleX,
    color: '#ef4444',
  },
};

export interface MarkdownCalloutProps extends HTMLAttributes<HTMLDivElement> {
  tone?: MarkdownCalloutTone;
}

export function MarkdownCallout({
  tone = 'note',
  className,
  style,
  children,
  role,
  ...props
}: MarkdownCalloutProps) {
  const calloutConfig = MARKDOWN_CALLOUT_CONFIG[tone];
  const Icon = calloutConfig.icon;
  const calloutStyle = {
    '--callout-color': calloutConfig.color,
    ...style,
  } as CSSProperties;

  return (
    <div
      className={cn(
        'my-4 flex gap-2 rounded-lg border bg-muted/50 p-3 ps-1 text-sm text-card-foreground shadow-md',
        className
      )}
      role={role ?? 'note'}
      style={calloutStyle}
      data-callout={tone}
      {...props}
    >
      <div role="none" className="w-0.5 rounded-sm opacity-60" style={{ backgroundColor: 'var(--callout-color)' }} />
      <Icon
        aria-hidden
        className="size-5 -me-0.5 shrink-0"
        style={{ color: 'var(--callout-color)' }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="prose-no-margin text-muted-foreground empty:hidden">{children}</div>
      </div>
    </div>
  );
}
