# =============================================================================
# mdplane Backend Dockerfile (Root Alias)
# This file redirects to apps/server/Dockerfile for backward compatibility
# For the canonical Dockerfile, see: apps/server/Dockerfile
# =============================================================================

# Build stage
FROM oven/bun:1.1 AS builder
WORKDIR /app

# Install pnpm for monorepo dependency resolution
RUN npm install -g pnpm

# Copy dependency manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY tsconfig.json tsconfig.base.json ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

# Build shared package first, then server
RUN pnpm --filter @mdplane/shared build
RUN pnpm --filter @mdplane/server build

# =============================================================================
# Production stage - minimal image
# =============================================================================
FROM oven/bun:1.1-slim AS runner
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN addgroup --system --gid 1001 mdplane && \
    adduser --system --uid 1001 --ingroup mdplane mdplane

# Copy built artifacts from builder stage
COPY --from=builder --chown=mdplane:mdplane /app/apps/server/dist ./dist
COPY --from=builder --chown=mdplane:mdplane /app/apps/server/package.json ./
COPY --from=builder --chown=mdplane:mdplane /app/packages/shared/openapi.bundled.yaml ./openapi.bundled.yaml

# Create data directory for SQLite persistence
RUN mkdir -p /data && chown mdplane:mdplane /data
VOLUME ["/data"]

# Switch to non-root user
USER mdplane

# Environment configuration
ENV NODE_ENV=production
ENV DATABASE_URL=/data/mdplane.sqlite
ENV PORT=3001

# Expose API port
EXPOSE 3001

# Health check - verify API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the server
CMD ["bun", "run", "dist/index.js"]
