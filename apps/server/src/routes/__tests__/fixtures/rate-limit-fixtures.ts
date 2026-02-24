import { clearAllRateLimits } from '../../../services/rate-limit';

export function resetRateLimitTestState(): void {
  clearAllRateLimits();
}
