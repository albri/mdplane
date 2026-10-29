import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // Short leases so expiry can be tested in real time. The tests make more workspaces than a
      // day allows, so the daily limit is only on in the test about it.
      miniflare: { bindings: { LEASE_SECONDS: '0.3', CREATE_DAILY_LIMIT: '0' } },
    }),
  ],
})
