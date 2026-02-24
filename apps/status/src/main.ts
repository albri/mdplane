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
const API_ORIGIN_QUERY_PARAM = 'api';

const SYSTEM_STATUSES = ['operational', 'degraded', 'partial_outage', 'major_outage'] as const;
const COMPONENT_STATUSES = ['operational', 'degraded', 'down'] as const;
const ENVIRONMENTS = ['development', 'test', 'production'] as const;

type JsonRecord = Record<string, unknown>;
type ComponentStatus = StatusResponse['data']['database']['status'];

interface ApiOriginConfig {
  origin: string;
  isOverridden: boolean;
}

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

function parseApiOrigin(): ApiOriginConfig {
  const value = new URLSearchParams(window.location.search).get(API_ORIGIN_QUERY_PARAM);
  const candidate = value === null || value.trim() === '' ? DEFAULT_API_ORIGIN : value.trim();
  const isOverridden = value !== null && value.trim() !== '';

  try {
    return { origin: new URL(candidate).origin, isOverridden };
  } catch {
    return { origin: DEFAULT_API_ORIGIN, isOverridden: false };
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

function setOverallCalloutTone(className: PillClass): void {
  const callout = requireElement('overall-callout');
  callout.classList.remove('tone-operational', 'tone-degraded', 'tone-down', 'tone-neutral');

  switch (className) {
    case 'status-operational':
      callout.classList.add('tone-operational');
      break;
    case 'status-degraded':
      callout.classList.add('tone-degraded');
      break;
    case 'status-down':
      callout.classList.add('tone-down');
      break;
    default:
      callout.classList.add('tone-neutral');
  }
}

function setHeadlineStatus(label: string, className: PillClass): void {
  setText('headline-status', label);
  setOverallCalloutTone(className);

  const icon = requireElement('headline-icon');
  if (className === 'status-operational') {
    icon.textContent = '✓';
    return;
  }
  if (className === 'status-degraded') {
    icon.textContent = '!';
    return;
  }
  if (className === 'status-down') {
    icon.textContent = '!';
    return;
  }
  icon.textContent = '...';
}

function renderService(id: string, label: string, statusClass: PillClass): void {
  const cell = requireElement(id);
  const chip = document.createElement('span');
  chip.className = `status-pill ${statusClass}`;
  chip.textContent = label;
  cell.replaceChildren(chip);
}

function setStaleIndicator(isStale: boolean): void {
  requireElement('stale-pill').hidden = !isStale;
}

function requireRefreshButton(): HTMLButtonElement {
  const element = requireElement('refresh-button');
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Missing required refresh button');
  }
  return element;
}

function requireRefreshLabel(): HTMLElement {
  return requireElement('refresh-label');
}

function setRefreshPending(isPending: boolean): void {
  const button = requireRefreshButton();
  button.disabled = isPending;
  requireRefreshLabel().textContent = isPending ? 'Refreshing...' : 'Refresh';
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
      const serviceTimestampMs = parseIsoDate(statusPayload.data.timestamp) ?? checkedAtMs;
      state.lastHealthyAtMs = serviceTimestampMs;
      displayTimestampMs = serviceTimestampMs;

      const overallClass = overallStatusClass(statusPayload.data.status);
      setHeadlineStatus(overallStatusHeadline(statusPayload.data.status), overallClass);

      const apiPresentation = apiPresentationFromOverallStatus(statusPayload.data.status);
      const storagePresentation = componentPresentation(statusPayload.data.storage.status);
      const realtimePresentation = componentPresentation(statusPayload.data.websocket.status);

      renderService('service-api', apiPresentation.label, apiPresentation.className);
      renderService('service-storage', storagePresentation.label, storagePresentation.className);
      renderService('service-realtime', realtimePresentation.label, realtimePresentation.className);
    } else if (healthPayload !== null) {
      const serviceTimestampMs = parseIsoDate(healthPayload.timestamp) ?? checkedAtMs;
      state.lastHealthyAtMs = serviceTimestampMs;
      displayTimestampMs = serviceTimestampMs;

      setHeadlineStatus('Core API healthy', 'status-operational');

      renderService('service-api', 'Operational', 'status-operational');
      renderService('service-storage', 'Unknown', 'status-neutral');
      renderService('service-realtime', 'Unknown', 'status-neutral');
    } else {
      setHeadlineStatus('Unable to verify platform status', 'status-down');
      renderService('service-api', 'Unavailable', 'status-down');
      renderService('service-storage', 'No data', 'status-neutral');
      renderService('service-realtime', 'No data', 'status-neutral');
    }

    setText('updated-at', `Last fetched: ${formatDateTime(displayTimestampMs)}`);
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
  const apiOrigin = parseApiOrigin();
  const apiOriginElement = requireElement('api-origin');
  if (apiOrigin.isOverridden) {
    apiOriginElement.hidden = false;
    apiOriginElement.textContent = `API origin override: ${apiOrigin.origin}`;
  } else {
    apiOriginElement.hidden = true;
  }

  requireElement('refresh-button').addEventListener('click', () => {
    void poll(apiOrigin.origin);
  });

  setHeadlineStatus('Checking current platform status...', 'status-neutral');
  renderService('service-api', 'Checking', 'status-neutral');
  renderService('service-storage', 'Checking', 'status-neutral');
  renderService('service-realtime', 'Checking', 'status-neutral');
  startPolling(apiOrigin.origin);
}

boot();
