.PHONY: install dev build test test-server test-cli test-integration test-e2e lint lint-fix format format-check clean typecheck \
	docker-selfhost-minimal-up docker-selfhost-minimal-down docker-selfhost-minimal-logs docker-selfhost-minimal-build docker-selfhost-minimal-restart docker-selfhost-minimal-clean \
	docker-selfhost-full-up docker-selfhost-full-down docker-selfhost-full-logs docker-selfhost-full-build docker-selfhost-full-restart docker-selfhost-full-clean \
	db-generate db-push db-migrate \
	check-routes check-enums check-query-params \
	generate-types generate-check setup reset

SELFHOST_ENV_FILE ?= .env.selfhost

# =============================================================================
# Package Management
# =============================================================================

install:
	pnpm install

# =============================================================================
# Development
# =============================================================================

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

test-server:
	pnpm test:server

test-cli:
	pnpm test:cli

test-integration:
	pnpm test:integration

test-e2e:
	pnpm test:e2e

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

format:
	pnpm format

format-check:
	pnpm format:check

typecheck:
	pnpm typecheck

clean:
	pnpm clean

# =============================================================================
# Docker Commands (Self-Host Minimal Profile)
# =============================================================================

docker-selfhost-minimal-up:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.minimal.yml up -d --build

docker-selfhost-minimal-down:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.minimal.yml down

docker-selfhost-minimal-logs:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.minimal.yml logs -f

docker-selfhost-minimal-build:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.minimal.yml build

docker-selfhost-minimal-restart:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.minimal.yml restart

docker-selfhost-minimal-clean:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.minimal.yml down -v --rmi local

# =============================================================================
# Docker Commands (Self-Host Full Profile)
# =============================================================================

docker-selfhost-full-up:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.full.yml up -d --build

docker-selfhost-full-down:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.full.yml down

docker-selfhost-full-logs:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.full.yml logs -f

docker-selfhost-full-build:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.full.yml build

docker-selfhost-full-restart:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.full.yml restart

docker-selfhost-full-clean:
	docker compose --env-file $(SELFHOST_ENV_FILE) -f docker-compose.selfhost.full.yml down -v --rmi local

# =============================================================================
# Database Commands (server has embedded SQLite - these are for drizzle)
# =============================================================================

db-generate:
	pnpm --filter @mdplane/server db:generate

db-push:
	pnpm --filter @mdplane/server db:push

db-migrate:
	pnpm --filter @mdplane/server db:migrate

# =============================================================================
# Code Quality Checks
# =============================================================================

check-routes:
	pnpm check:route-coverage && pnpm check:route-db-usage && pnpm check:domain-route-imports

check-enums:
	pnpm check:enum-sync

check-query-params:
	pnpm check:query-params

# =============================================================================
# Type Generation
# =============================================================================

generate-types:
	pnpm --filter @mdplane/shared generate

generate-check:
	pnpm --filter @mdplane/shared generate:check

# =============================================================================
# Utility Commands
# =============================================================================

setup: install
	@echo "Setup complete!"

reset: clean install
	@echo "Reset complete!"

