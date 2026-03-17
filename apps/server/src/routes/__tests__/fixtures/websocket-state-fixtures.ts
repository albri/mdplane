import { matchesScope as domainMatchesScope } from '../../../domain/websocket/broadcast';
import { resetRateLimitState as domainResetRateLimitState } from '../../../domain/websocket/subscription';
import { clearUsedTokens as clearWsUsedTokens } from '../../../domain/websocket/state';

export function matchesScope(path: string, scope: string): boolean {
  return domainMatchesScope(path, scope);
}

export function resetWebsocketState(): void {
  domainResetRateLimitState();
  clearWsUsedTokens();
}

export function resetRateLimitState(): void {
  domainResetRateLimitState();
}

export function clearUsedTokens(): void {
  clearWsUsedTokens();
}
