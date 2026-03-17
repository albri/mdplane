/**
 * Integration Tests Utilities
 *
 * Helper functions for test assertions and utilities.
 */

import { CONFIG } from '../config';

/**
 * Generate a unique name with integration test prefix
 */
export function uniqueName(suffix?: string): string {
  const random = Math.random().toString(36).substring(2, 8);
  const base = `${CONFIG.TEST_PREFIX}${Date.now()}_${random}`;
  return suffix ? `${base}_${suffix}` : base;
}

/**
 * Delay for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert response is ok, throw with body on failure
 */
export async function expectOk(response: Response, context?: string): Promise<void> {
  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '<could not read body>';
    }
    const ctx = context ? ` (${context})` : '';
    throw new Error(`Expected OK response${ctx}, got ${response.status}: ${body}`);
  }
}

/**
 * Assert response matches expected status
 */
export async function expectStatus(
  response: Response,
  expectedStatus: number,
  context?: string
): Promise<void> {
  if (response.status !== expectedStatus) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '<could not read body>';
    }
    const ctx = context ? ` (${context})` : '';
    throw new Error(
      `Expected status ${expectedStatus}${ctx}, got ${response.status}: ${body}`
    );
  }
}
