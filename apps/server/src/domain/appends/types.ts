import type {
  AppendType as GeneratedAppendType,
  AppendRequest,
  MultiAppendRequest,
  AppendItem,
  AppendResponse,
  MultiAppendResult,
  Priority,
} from '@mdplane/shared';
import type { KeyValidationResult, CapabilityKeyRecord } from '../../shared';

export type AppendType = GeneratedAppendType;

export const AUTHOR_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
export const RESERVED_AUTHORS = ['system'];
export const DEFAULT_CLAIM_EXPIRY_SECONDS = 1800;

type SingleAppendFields = Pick<
  AppendRequest,
  'path' | 'type' | 'content' | 'ref' | 'priority' | 'labels' | 'dueAt' | 'assigned' | 'value' | 'relatedTo' | 'expiresInSeconds'
>;
type MultiAppendFields = Pick<MultiAppendRequest, 'path' | 'appends'>;

export type AppendRequestBody = { author: string } & Partial<SingleAppendFields & MultiAppendFields>;

export type HandleAppendRequestInput = {
  key: string;
  path: string;
  body: AppendRequestBody;
  idempotencyKey: string | null;
  keyResult: KeyValidationResult;
};

export type ProcessSingleAppendInput = {
  file: { id: string };
  author: string;
  item: AppendItem;
  capKey: CapabilityKeyRecord;
  now: Date;
};

export type HandleMultiAppendInput = {
  key: string;
  file: { id: string; path: string };
  author: string;
  appendItems: AppendItem[];
  capKey: CapabilityKeyRecord;
  idempotencyKey: string | null;
};

export type ProcessSingleAppendResult =
  | { ok: true; data: MultiAppendResult['appends'][number] }
  | { ok: false; error: { code: string; message?: string; details?: Record<string, unknown> } };

export type AppendsErrorBody = {
  ok: false;
  error: {
    code: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

export type HandleMultiAppendResult = {
  status: number;
  body: AppendResponse | AppendsErrorBody;
};

export type HandleAppendRequestResult = {
  status: number;
  body: AppendResponse | AppendsErrorBody;
  headers?: Record<string, string>;
};

export type { AppendItem, Priority, AppendRequest, MultiAppendRequest };
export type { KeyValidationResult, CapabilityKeyRecord };
