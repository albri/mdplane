/**
 * Test Application Factory
 *
 * Creates a complete Elysia app with all routes for scenario testing.
 * This allows integration tests to make requests against the full API surface.
 *
 * @example
 * ```typescript
 * const app = createTestApp();
 * const response = await app.handle(new Request('http://localhost/bootstrap', { method: 'POST' }));
 * ```
 */

import { Elysia } from 'elysia';

// Import middleware
import { rateLimitMiddleware } from '../../src/core/rate-limit-middleware';
import { clearAllRateLimits } from '../../src/services/rate-limit';

// Import all routes
import { bootstrapRoute } from '../../src/routes/bootstrap';
import { filesRoute } from '../../src/routes/files';
import { foldersRoute } from '../../src/routes/folders';
import { appendsRoute } from '../../src/routes/appends';
import { claimRoute } from '../../src/routes/claim';
import { orchestrationRoute } from '../../src/routes/orchestration';
import { webhooksRoute } from '../../src/routes/webhooks';
import { keysRoute } from '../../src/routes/keys';
import { searchRoute } from '../../src/routes/search';
import { auditRoute } from '../../src/routes/audit';
import { exportRoute } from '../../src/routes/export';
import { statusRoute } from '../../src/routes/status';
import { systemRoute } from '../../src/routes/system';
import { apiKeysRoute } from '../../src/routes/api-keys';
import { authRoute } from '../../src/routes/auth';
import { heartbeatRoute } from '../../src/routes/heartbeat';
import { workspaceOrchestrationRoute } from '../../src/routes/workspace-orchestration';

/**
 * Creates a complete Elysia application with all routes mounted.
 *
 * This is the primary entry point for scenario tests that need to test
 * full user workflows across multiple endpoints.
 *
 * @returns A fully configured Elysia application instance
 */
export interface CreateTestAppOptions {
  /** Enable rate limiting middleware (default: false for backward compatibility) */
  withRateLimiting?: boolean;
}

/**
 * Creates a complete Elysia application with all routes mounted.
 *
 * @param options - Configuration options
 * @returns A fully configured Elysia application instance
 */
export function createTestApp(options: CreateTestAppOptions = {}): Elysia {
  // Clear rate limits between tests to prevent cross-test pollution
  clearAllRateLimits();

  const app = new Elysia();

  // Only add rate limiting if explicitly requested
  if (options.withRateLimiting) {
    app.use(rateLimitMiddleware());
  }

  // Build the app with all routes and cast to base Elysia type
  // This is safe because we only use app.handle() in tests which is available on base type
  return app
    // Core routes
    .use(bootstrapRoute)
    .use(filesRoute)
    .use(foldersRoute)
    .use(appendsRoute)
    .use(claimRoute)
    .use(orchestrationRoute)
    .use(webhooksRoute)
    .use(keysRoute)
    .use(searchRoute)
    // Additional routes
    .use(auditRoute)
    .use(exportRoute)
    .use(statusRoute)
    .use(systemRoute)
    .use(apiKeysRoute)
    .use(authRoute)
    .use(heartbeatRoute)
    .use(workspaceOrchestrationRoute) as unknown as Elysia;
}

