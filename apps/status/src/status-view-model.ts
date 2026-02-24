import type { StatusResponse } from '@mdplane/shared';

export type PillClass = 'status-operational' | 'status-degraded' | 'status-down' | 'status-neutral';
type ComponentStatus = StatusResponse['data']['database']['status'];
type OverallStatus = StatusResponse['data']['status'];

interface StatusPresentation {
  className: PillClass;
  label: string;
}

export function overallStatusClass(status: OverallStatus): PillClass {
  if (status === 'operational') return 'status-operational';
  if (status === 'degraded') return 'status-degraded';
  return 'status-down';
}

export function overallStatusHeadline(status: OverallStatus): string {
  if (status === 'operational') return 'All systems operational';
  if (status === 'degraded') return 'Some systems degraded';
  if (status === 'partial_outage') return 'Partial service outage';
  return 'Major service outage';
}

export function apiPresentationFromOverallStatus(status: OverallStatus): StatusPresentation {
  if (status === 'operational') {
    return { className: 'status-operational', label: 'Operational' };
  }
  if (status === 'degraded') {
    return { className: 'status-degraded', label: 'Degraded' };
  }
  return { className: 'status-down', label: 'Unavailable' };
}

export function componentPresentation(status: ComponentStatus): StatusPresentation {
  if (status === 'operational') {
    return { className: 'status-operational', label: 'Operational' };
  }
  if (status === 'degraded') {
    return { className: 'status-degraded', label: 'Degraded' };
  }
  return { className: 'status-down', label: 'Unavailable' };
}

export function isStale(lastHealthyAtMs: number | undefined, nowMs: number, staleAfterMs: number): boolean {
  return lastHealthyAtMs !== undefined && nowMs - lastHealthyAtMs > staleAfterMs;
}
