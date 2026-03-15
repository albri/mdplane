import type { HealthCheckSimpleResponse, StatusResponse } from '@mdplane/shared';
import {
  apiPresentationFromOverallStatus,
  componentPresentation,
  isStale,
  overallStatusClass,
  overallStatusHeadline,
  type PillClass,
} from './status-view-model.js';

const DEFAULT_API_ORIGIN = 'https://api.mdplane.dev';
const POLL_INTERVAL_MS = 30_000;
const STALE_AFTER_MS = 2 * POLL_INTERVAL_MS;
const REQUEST_TIMEOUT_MS = 10_000;

const SYSTEM_STATUSES = ['operational', 'degraded', 'partial_outage', 'major_outage'] as const;
const COMPONENT_STATUSES = ['operational', 'degraded', 'down'] as const;
const ENVIRONMENTS = ['development', 'test', 'production'] as const;

type JsonRecord = Record<string, unknown>;
type ComponentStatus = StatusResponse['data']['database']['status'];

interface AppState {
  lastHealthyAtMs?: number;
  latestPollId: number;
  activePolls: number;
}

const state: AppState = {
  latestPollId: 0,
  activePolls: 0,
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && options.includes(value);
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element;
}

function setText(id: string, value: string): void {
  requireElement(id).textContent = value;
}

function parseApiOrigin(): string {
  const value = new URLSearchParams(window.location.search).get('api');
  if (value === null || value.trim() === '') return DEFAULT_API_ORIGIN;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}

function parseComponent(value: unknown): { status: ComponentStatus } | null {
  if (!isRecord(value) || !isOneOf(value.status, COMPONENT_STATUSES)) {
    return null;
  }
  return { status: value.status };
}

function parseStatusResponse(value: unknown): StatusResponse | null {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.data)) {
    return null;
  }

  const data = value.data;
  if (!isOneOf(data.status, SYSTEM_STATUSES)) {
    return null;
  }
  if (
    typeof data.timestamp !== 'string'
    || !isOneOf(data.environment, ENVIRONMENTS)
    || typeof data.version !== 'string'
    || !isFiniteNumber(data.uptimeSeconds)
  ) {
    return null;
  }

  const database = parseComponent(data.database);
  const storage = parseComponent(data.storage);
  const websocket = parseComponent(data.websocket);
  if (database === null || storage === null || websocket === null) {
    return null;
  }

  if (!Array.isArray(data.regions)) {
    return null;
  }
  const regions: StatusResponse['data']['regions'] = [];
  for (const region of data.regions) {
    if (!isRecord(region) || typeof region.name !== 'string' || !isOneOf(region.status, COMPONENT_STATUSES)) {
      return null;
    }
    regions.push({ name: region.name, status: region.status });
  }

  return {
    ok: true,
    data: {
      status: data.status,
      timestamp: data.timestamp,
      environment: data.environment,
      uptimeSeconds: data.uptimeSeconds,
      version: data.version,
      database,
      storage,
      websocket,
      regions,
    },
  };
}

function parseHealthResponse(value: unknown): HealthCheckSimpleResponse | null {
  if (!isRecord(value) || value.ok !== true || value.status !== 'healthy') {
    return null;
  }

  const response: HealthCheckSimpleResponse = { ok: true, status: 'healthy' };
  if (typeof value.timestamp === 'string') {
    response.timestamp = value.timestamp;
  }
  if (isFiniteNumber(value.uptimeSeconds)) {
    response.uptimeSeconds = value.uptimeSeconds;
  }
  if (typeof value.version === 'string') {
    response.version = value.version;
  }
  return response;
}

function parseIsoDate(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const timestampMs = Date.parse(value);
  return Number.isNaN(timestampMs) ? null : timestampMs;
}

function formatDateTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString();
}

function setBannerTone(className: PillClass): void {
  const banner = requireElement('status-banner');
  banner.classList.remove('operational', 'degraded', 'down');

  switch (className) {
    case 'status-operational':
      banner.classList.add('operational');
      break;
    case 'status-degraded':
      banner.classList.add('degraded');
      break;
    case 'status-down':
      banner.classList.add('down');
      break;
  }
}

function setHeadlineStatus(label: string, className: PillClass): void {
  setText('status-headline', label);
  setBannerTone(className);

  const icon = requireElement('status-icon');
  if (className === 'status-operational') {
    icon.textContent = '✓';
    return;
  }
  if (className === 'status-degraded' || className === 'status-down') {
    icon.textContent = '!';
    return;
  }
  icon.textContent = '?';
}

function renderService(id: string, label: string, statusClass: PillClass): void {
  const cell = requireElement(id);
  cell.className = `badge badge-${statusClass.replace('status-', '')}`;
  cell.textContent = label;
}

function setStaleIndicator(stale: boolean): void {
  requireElement('stale-badge').hidden = !stale;
}

function showError(show: boolean): void {
  requireElement('services-section').hidden = show;
  requireElement('error-section').hidden = !show;
}

function requireRefreshButton(): HTMLButtonElement {
  const element = requireElement('refresh-btn');
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Missing required refresh button');
  }
  return element;
}

function setRefreshPending(isPending: boolean): void {
  const button = requireRefreshButton();
  button.disabled = isPending;
  button.textContent = isPending ? 'Refreshing...' : 'Refresh';
}

function completePoll(): void {
  state.activePolls = Math.max(0, state.activePolls - 1);
  if (state.activePolls === 0) {
    setRefreshPending(false);
  }
}

async function fetchJson(origin: string, path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${origin}${path}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as unknown;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function poll(origin: string): Promise<void> {
  const pollId = state.latestPollId + 1;
  state.latestPollId = pollId;
  state.activePolls += 1;
  setRefreshPending(true);

  try {
    const [statusRaw, healthRaw] = await Promise.all([
      fetchJson(origin, '/api/v1/status'),
      fetchJson(origin, '/health'),
    ]);

    if (pollId !== state.latestPollId) {
      return;
    }

    const statusPayload = parseStatusResponse(statusRaw);
    const healthPayload = parseHealthResponse(healthRaw);
    const checkedAtMs = Date.now();
    let displayTimestampMs = checkedAtMs;

    if (statusPayload !== null) {
      showError(false);
      const serviceTimestampMs = parseIsoDate(statusPayload.data.timestamp) ?? checkedAtMs;
      state.lastHealthyAtMs = serviceTimestampMs;
      displayTimestampMs = serviceTimestampMs;

      const overallClass = overallStatusClass(statusPayload.data.status);
      setHeadlineStatus(overallStatusHeadline(statusPayload.data.status), overallClass);

      const apiPresentation = apiPresentationFromOverallStatus(statusPayload.data.status);
      const storagePresentation = componentPresentation(statusPayload.data.storage.status);
      const realtimePresentation = componentPresentation(statusPayload.data.websocket.status);

      renderService('svc-api', apiPresentation.label, apiPresentation.className);
      renderService('svc-storage', storagePresentation.label, storagePresentation.className);
      renderService('svc-realtime', realtimePresentation.label, realtimePresentation.className);
    } else if (healthPayload !== null) {
      showError(false);
      const serviceTimestampMs = parseIsoDate(healthPayload.timestamp) ?? checkedAtMs;
      state.lastHealthyAtMs = serviceTimestampMs;
      displayTimestampMs = serviceTimestampMs;

      setHeadlineStatus('Core API healthy', 'status-operational');

      renderService('svc-api', 'Operational', 'status-operational');
      renderService('svc-storage', 'Unknown', 'status-neutral');
      renderService('svc-realtime', 'Unknown', 'status-neutral');
    } else {
      showError(true);
      setHeadlineStatus('Unable to reach platform', 'status-down');
    }

    setText('status-meta', `Last checked: ${formatDateTime(displayTimestampMs)}`);
    setStaleIndicator(isStale(state.lastHealthyAtMs, Date.now(), STALE_AFTER_MS));
  } finally {
    completePoll();
  }
}

function startPolling(origin: string): void {
  void poll(origin);
  window.setInterval(() => {
    void poll(origin);
  }, POLL_INTERVAL_MS);
}

function boot(): void {
  const origin = parseApiOrigin();

  requireElement('refresh-btn').addEventListener('click', () => void poll(origin));
  requireElement('retry-btn').addEventListener('click', () => void poll(origin));

  setHeadlineStatus('Checking status...', 'status-neutral');
  renderService('svc-api', '—', 'status-neutral');
  renderService('svc-storage', '—', 'status-neutral');
  renderService('svc-realtime', '—', 'status-neutral');
  startPolling(origin);
}

boot();
