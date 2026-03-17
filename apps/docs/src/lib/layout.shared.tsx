import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ThemedLogo } from '@mdplane/ui';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <ThemedLogo />,
    },
    githubUrl: 'https://github.com/albri/mdplane',
  };
}
