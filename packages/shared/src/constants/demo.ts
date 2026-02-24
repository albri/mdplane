/**
 * Demo Workspace Constants
 *
 * Public constants for the demo workspace. Only the read key is exposed here
 * since it's used by the frontend to redirect to the demo.
 *
 * The demo workspace is read-only - no append/write keys are created.
 */

/**
 * Demo workspace ID - fixed for consistent seeding
 */
export const DEMO_WORKSPACE_ID = 'ws_demo_acme_agents';

/**
 * Demo read key - follows realistic key format (22+ base62 chars)
 * This is a fixed value so the frontend can link to it.
 */
export const DEMO_READ_KEY = 'm7dXp9lKa2nQe4R8vL5wYt';

/**
 * Demo workspace name - looks like a real project
 */
export const DEMO_WORKSPACE_NAME = 'Acme AI Agents';

