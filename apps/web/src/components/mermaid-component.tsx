'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { getMermaidInitializeConfig } from './mermaid-theme';

interface MermaidComponentProps {
  chart: string;
}

function logMermaidError(error: unknown) {
  if (process.env.NODE_ENV === 'production') return;
  console.error('Mermaid rendering error:', error);
}

export default function MermaidComponent({ chart }: MermaidComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    let isMounted = true;

    async function renderMermaid() {
      try {
        const mermaid = await import('mermaid');
        const config = getMermaidInitializeConfig(isDark);
        mermaid.default.initialize(config);

        if (containerRef.current && isMounted) {
          const { svg } = await mermaid.default.render(
            `mermaid-${Math.random().toString(36).substring(7)}`,
            chart
          );
          
          if (isMounted && containerRef.current) {
            containerRef.current.innerHTML = svg;
            const renderedSvg = containerRef.current.querySelector('svg');
            if (renderedSvg) {
              renderedSvg.style.maxWidth = '100%';
              renderedSvg.style.height = 'auto';
              renderedSvg.style.display = 'block';
              renderedSvg.style.margin = '0 auto';
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          logMermaidError(err);
          setError('Failed to render diagram');
        }
      }
    }

    renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [chart, isDark]);

  if (error) {
    return (
      <div className="w-full rounded border border-destructive/20 bg-destructive/10 p-4">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full min-h-[220px] overflow-x-auto rounded-xl border border-border bg-card p-4"
    />
  );
}
