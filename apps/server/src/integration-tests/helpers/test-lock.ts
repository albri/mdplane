/**
 * Simple async lock for integration tests.
 *
 * Bun may schedule tests concurrently. Some suites (WebSocket) assume a
 * serialized interaction with a shared local server and per-key limits.
 * This lock lets us run those tests deterministically without changing
 * production behavior.
 */

export class AsyncLock {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;
    let release: (() => void) | undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await prev;
    try {
      return await fn();
    } finally {
      release?.();
    }
  }
}

export const integrationLock = new AsyncLock();
