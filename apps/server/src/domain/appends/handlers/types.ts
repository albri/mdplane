import type { CapabilityKeyRecord } from '../../../shared';
import type { SingleAppendResult } from '@mdplane/shared';
import type { AppendType, AppendRequestBody } from '../types';

export interface AppendHandlerContext {
  db: typeof import('../../../db').db;
  sqlite: typeof import('../../../db').sqlite;
  file: { id: string; workspaceId: string };
  author: string;
  body: AppendRequestBody;
  now: Date;
  nowIso: string;
  appendId: string;
  capKey: CapabilityKeyRecord;
}

export type AppendResponsePatch = Partial<Omit<SingleAppendResult, 'id' | 'type' | 'author' | 'ts'>>;

export interface AppendHandlerSuccess {
  responsePatch: AppendResponsePatch;
}

export interface AppendHandlerError {
  status: number;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export type AppendHandlerResult = AppendHandlerSuccess | AppendHandlerError;

export function isHandlerError(result: AppendHandlerResult): result is AppendHandlerError {
  return 'status' in result && 'error' in result;
}

