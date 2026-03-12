import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@mdplane/ui';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    githubUrl: 'https://github.com/albri/mdplane',
  };
}
