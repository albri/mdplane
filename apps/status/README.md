# @mdplane/status

Static, framework-free status page for `status.mdplane.dev`.

It polls:

- `GET /api/v1/status` (comprehensive status)
- `GET /health` (liveness fallback)

## Commands

```bash
pnpm --filter @mdplane/status test
pnpm --filter @mdplane/status typecheck
pnpm --filter @mdplane/status lint
pnpm --filter @mdplane/status build
pnpm --filter @mdplane/status dev
```

Local URL: <http://localhost:3000>

`dev` runs TypeScript in watch mode and serves `dist/` on port `3000`.
`build` emits fingerprinted `main.*.js` and `styles.*.css` assets for cache-safe deploys.

## API origin override

Pass `?api=<origin>`:

- <http://localhost:3000/?api=http://127.0.0.1:3001>
- <http://localhost:3000/?api=https://api.mdplane.dev>

## Local CORS note

If production API CORS does not allow `http://localhost:3000`, browser requests will fail locally even when direct endpoint navigation works.
