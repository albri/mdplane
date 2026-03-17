export function parseErrorCode(responseBody: string): string | null {
  try {
    const parsed = JSON.parse(responseBody) as { error?: { code?: unknown } };
    return typeof parsed.error?.code === 'string' ? parsed.error.code : null;
  } catch {
    return null;
  }
}

export function isRetryableClaimFailure(status: number, responseBody: string): boolean {
  if (status === 404 || status >= 500) {
    return true;
  }

  if (status === 400) {
    const code = parseErrorCode(responseBody);
    return code === 'NOT_FOUND' || code === 'INVALID_KEY';
  }

  return false;
}

export function getRetryDelayMs(attempt: number): number {
  const baseMs = 250;
  const maxMs = 2000;
  return Math.min(maxMs, baseMs * Math.max(1, attempt));
}

