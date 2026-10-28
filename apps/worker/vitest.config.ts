import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // Short leases so expiry can be tested in real time.
      miniflare: { bindings: { LEASE_SECONDS: '0.3' } },
    }),
  ],
})
