# =============================================================================
# mdplane Docs Dockerfile
# Builds and runs the Fumadocs Next.js site for self-host full profile
# =============================================================================

FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/docs/package.json ./apps/docs/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts

COPY tsconfig.json tsconfig.base.json ./
COPY apps/docs ./apps/docs
COPY packages/shared ./packages/shared

RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts

RUN pnpm --filter @mdplane/docs build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
RUN npm install -g pnpm

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nextjs:nodejs /app/apps/docs ./apps/docs
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared ./packages/shared

USER nextjs
WORKDIR /app/apps/docs

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/ || exit 1

CMD ["pnpm", "start", "-p", "3002"]
