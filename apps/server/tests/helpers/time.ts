/**
 * Time Manipulation Utilities for Testing
 *
 * Provides utilities for testing time-dependent functionality like claim expiry.
 * Uses a time offset approach that can be injected into the application's time provider.
 *
 * @example
 * ```typescript
 * // Advance time by 1 hour to expire claims
 * advanceTime(60 * 60 * 1000);
 *
 * // Reset time after test
 * resetTime();
 * ```
 */

/** Current time offset in milliseconds */
let timeOffset = 0;

/** Original Date.now function for restoration */
const originalDateNow = Date.now;

/** Whether Date.now is currently mocked */
let isMocked = false;

/**
 * Advance the simulated time by a given number of milliseconds.
 *
 * @param ms - Number of milliseconds to advance time by
 */
export function advanceTime(ms: number): void {
  timeOffset += ms;
}

/**
 * Reset the time offset back to zero.
 * Should be called in afterEach/afterAll hooks.
 */
export function resetTime(): void {
  timeOffset = 0;
}

/**
 * Get the current simulated time.
 *
 * @returns Current timestamp in milliseconds, with offset applied
 */
export function getCurrentTime(): number {
  return originalDateNow() + timeOffset;
}

/**
 * Get the current time offset.
 *
 * @returns Current offset in milliseconds
 */
export function getTimeOffset(): number {
  return timeOffset;
}

/**
 * Mock Date.now() to use the simulated time.
 * Call this at the start of tests that need time manipulation.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   mockDateNow();
 * });
 *
 * afterEach(() => {
 *   restoreDateNow();
 *   resetTime();
 * });
 * ```
 */
export function mockDateNow(): void {
  if (isMocked) return;
  Date.now = () => originalDateNow() + timeOffset;
  isMocked = true;
}

/**
 * Restore the original Date.now() function.
 * Should be called in afterEach/afterAll hooks.
 */
export function restoreDateNow(): void {
  if (!isMocked) return;
  Date.now = originalDateNow;
  isMocked = false;
}

/**
 * Helper to advance time and get an ISO timestamp at that point.
 *
 * @param offsetMs - Offset from current simulated time in milliseconds
 * @returns ISO timestamp string
 */
export function getTimestampAt(offsetMs: number = 0): string {
  return new Date(getCurrentTime() + offsetMs).toISOString();
}

/**
 * Convenience constants for common time durations (in milliseconds).
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

