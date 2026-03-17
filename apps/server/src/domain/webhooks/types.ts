import { zWebhookEvent } from '@mdplane/shared';
import type {
  ExtractData,
  WebhookCreateResponse,
  WebhookDeleteResponse,
  WebhookEvent as SharedWebhookEvent,
  WebhookListResponse,
  WebhookLogsResponse,
  WebhookTestResponse,
  WebhookUpdateResponse,
} from '@mdplane/shared';

export type WebhookEvent = SharedWebhookEvent;
export const VALID_EVENTS: readonly WebhookEvent[] = zWebhookEvent.options;

export type KeyValidationResult = {
  valid: boolean;
  workspaceId?: string;
};

export type GenerateSignatureInput = {
  payload: string;
  secret: string;
  timestamp: number;
};

export type DeliverWebhookInput = {
  url: string;
  payload: object;
  webhookId: string;
  secret: string;
};

export type DeliverWebhookResult = {
  delivered: boolean;
  responseCode?: number;
  durationMs: number;
  error?: string;
};

export type CreateWebhookInput = {
  workspaceId: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
};

export type WebhookAuditContext = {
  actorType: 'capability_url' | 'session';
  actor?: string;
};

export type CreateWebhookData = ExtractData<WebhookCreateResponse>;
export type WebhookListData = ExtractData<WebhookListResponse>;
export type WebhookDeleteData = ExtractData<WebhookDeleteResponse>;
export type WebhookUpdateData = ExtractData<WebhookUpdateResponse>;
export type WebhookLogsData = ExtractData<WebhookLogsResponse>;
export type WebhookTestData = ExtractData<WebhookTestResponse>;

export type WebhookRecord = {
  id: string;
  workspaceId: string;
  url: string;
  events: string;
  scopeType: string | null;
  scopePath: string | null;
  secretHash: string | null;
  createdAt: string;
  failureCount: number | null;
  disabledAt: string | null;
  lastTriggeredAt: string | null;
  deletedAt: string | null;
};

export type UpdateWebhookInput = {
  webhookId: string;
  workspaceId: string;
  url?: string;
  events?: WebhookEvent[];
  active?: boolean;
  secret?: string;
};

export type DeleteWebhookInput = {
  webhookId: string;
  workspaceId: string;
};

export type TestWebhookInput = {
  webhookId: string;
  workspaceId: string;
  event?: WebhookEvent;
};

export type GetLogsInput = {
  webhookId: string;
  workspaceId: string;
  limit?: number;
  since?: string;
};

