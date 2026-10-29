import type { WebpackOverrideFn } from '@remotion/bundler'

// Remotion Studio serves font files by their path, which doesn't resolve into a pnpm workspace's
// shared node_modules. Inlining the two fonts works the same in the studio and in renders.
export const inlineFonts: WebpackOverrideFn = (config) => ({
  ...config,
  module: {
    ...config.module,
    rules: (config.module?.rules ?? []).map((rule) =>
      rule &&
      typeof rule === 'object' &&
      rule.test instanceof RegExp &&
      rule.test.test('font.woff2')
        ? { ...rule, type: 'asset/inline' }
        : rule,
    ),
  },
})
