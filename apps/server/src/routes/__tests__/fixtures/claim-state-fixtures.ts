import { resetClaimState as domainResetClaimState } from '../../../domain/claim/handlers';

export function resetClaimState(): void {
  domainResetClaimState();
}
