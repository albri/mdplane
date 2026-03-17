# =============================================================================
# mdplane Landing Dockerfile
# Builds and runs the marketing site for self-host full profile
# =============================================================================

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile --prod=false

COPY tsconfig.json tsconfig.base.json ./
COPY apps/landing ./apps/landing
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui

RUN pnpm install --frozen-lockfile --prod=false

RUN pnpm --filter @mdplane/shared build
RUN pnpm --filter @mdplane/ui build
RUN pnpm --filter @mdplane/landing build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
RUN npm install -g pnpm

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing ./apps/landing
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nextjs:nodejs /app/packages/ui ./packages/ui

USER nextjs
WORKDIR /app/apps/landing

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["pnpm", "start", "-p", "3000"]
