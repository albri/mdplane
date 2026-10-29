import { defineConfig } from 'vitest/config'

// Playwright runs e2e/.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
