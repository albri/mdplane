import type { KeyValidationResult, Permission } from '../../shared';
import type { WebhookEvent } from '@mdplane/shared';

export type FolderWebhooksRouteResult<TData = unknown> = {
  status: number;
  body:
    | { ok: true; data: TData }
    | { ok: false; error: { code: string; message: string } };
};

export type FolderWebhookCreateInput = {
  keyString: string;
  path: string;
  body: {
    url: string;
    events: WebhookEvent[];
    secret?: string;
    recursive?: boolean;
  };
};

export type FolderWebhookUpdateInput = {
  keyString: string;
  path: string;
  webhookId: string;
  body: {
    url?: string;
    events?: WebhookEvent[];
    active?: boolean;
    secret?: string;
    recursive?: boolean;
  };
};

export type FolderWebhookDeleteInput = {
  keyString: string;
  path: string;
  webhookId: string;
};

export type FolderWebhookListInput = {
  keyString: string;
  path: string;
};

export type ValidateAndGetKeyInput = {
  keyString: string;
  pathHint?: string;
  requiredPermission?: Permission;
};

export type ValidateAndGetKeyFunction = (
  input: ValidateAndGetKeyInput
) => Promise<KeyValidationResult>;
