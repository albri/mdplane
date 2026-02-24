# =============================================================================
# mdplane Backend Dockerfile
# Multi-stage build for Bun runtime with SQLite persistence
# =============================================================================

# Build stage - use Node image for pnpm support
FROM node:20-slim AS builder
WORKDIR /app

# Install pnpm and bun
RUN npm install -g pnpm
RUN npm install -g bun

# Copy dependency manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (including dev deps needed for TypeScript package builds)
RUN pnpm install --frozen-lockfile --prod=false

# Copy source files
COPY tsconfig.json tsconfig.base.json ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

# Re-install after source copy so workspace package node_modules links are not overwritten by COPY.
RUN pnpm install --frozen-lockfile --prod=false

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

# Copy built artifacts from builder stage
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/drizzle ./drizzle
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/packages/shared/openapi.bundled.yaml ./openapi.bundled.yaml

# Verify migrations are present (fail build if not)
# Cache bust: 2026-01-17-v2
RUN test -f ./drizzle/meta/_journal.json || (echo "ERROR: drizzle migrations not found!" && exit 1)
RUN ls -la ./drizzle/ && ls -la ./drizzle/meta/
RUN test -f ./openapi.bundled.yaml || (echo "ERROR: OpenAPI spec not found in runtime image!" && exit 1)

# Environment configuration
ENV NODE_ENV=production
ENV DATABASE_URL=/data/mdplane.sqlite
# Note: PORT is provided by Railway at runtime

# Start the server - runs as root to access Railway volume
CMD ["bun", "run", "dist/index.js"]
