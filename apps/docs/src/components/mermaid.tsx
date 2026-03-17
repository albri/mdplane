'use client';

import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from 'next-themes';
import { getMermaidInitializeConfig } from '@mdplane/shared';

type MermaidProps = {
  chart: string;
};

export function Mermaid({ chart }: MermaidProps) {
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramId = useId().replace(/:/g, '');
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    let cancelled = false;

    mermaid.initialize(getMermaidInitializeConfig(isDark));

    void mermaid
      .render(`mdplane-mermaid-${diagramId}`, chart)
      .then(({ svg: renderedSvg, bindFunctions }) => {
        if (cancelled) {
          return;
        }

        setError(null);
        setSvg(renderedSvg);

        requestAnimationFrame(() => {
          if (!cancelled && containerRef.current) {
            const renderedSvgElement = containerRef.current.querySelector('svg');
            if (renderedSvgElement) {
              renderedSvgElement.style.maxWidth = '100%';
              renderedSvgElement.style.height = 'auto';
              renderedSvgElement.style.display = 'block';
              renderedSvgElement.style.margin = '0 auto';
            }

            if (bindFunctions) {
              bindFunctions(containerRef.current);
            }
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to render diagram');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId, isDark]);

  if (error) {
    return (
      <div className="not-prose rounded-xl border border-red-300/40 bg-red-50/60 p-4 text-sm text-red-900 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-100">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="not-prose min-h-[220px] overflow-x-auto rounded-xl border border-fd-border bg-fd-card p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
