const processStartedAtMs = Date.now();

export function getProcessStartedAtMs(): number {
  return processStartedAtMs;
}

export function getUptimeSeconds(nowMs: number = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - processStartedAtMs) / 1000));
}

export function getIsoTimestamp(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString();
}
