# =============================================================================
# mdplane Frontend Dockerfile
# Multi-stage build for Next.js standalone output
# =============================================================================

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm for monorepo dependency resolution
RUN npm install -g pnpm

# Copy dependency manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies (including dev deps needed for TypeScript package builds)
RUN pnpm install --frozen-lockfile --prod=false

# Copy source files
COPY tsconfig.json tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui

# Re-install after source copy so workspace package node_modules links are not overwritten by COPY.
RUN pnpm install --frozen-lockfile --prod=false

# Build packages in dependency order
RUN pnpm --filter @mdplane/shared build
RUN pnpm --filter @mdplane/ui build
RUN pnpm --filter @mdplane/web build

# =============================================================================
# Production stage - minimal image
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Switch to non-root user
USER nextjs

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose web port
EXPOSE 3000

# Health check - verify frontend is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start Next.js server
CMD ["node", "apps/web/server.js"]
