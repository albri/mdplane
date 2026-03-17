import { cleanupExpiredEntries } from '../services/rate-limit';

export async function cleanupExpiredRateLimits(): Promise<void> {
  cleanupExpiredEntries();
  console.log('[cleanupExpiredRateLimits] Purged expired rate limit entries');
}

