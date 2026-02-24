import type { ErrorCode } from '../../core/errors';
import type { Append, FileReadResponse } from '@mdplane/shared';
import type { FileStatsData } from './stats';

export type ReadFileQueryInput = {
  appends?: number;
  format?: string;
  include?: string;
  since?: string;
};

export type FileDeletedError = {
  code: 'FILE_DELETED';
  message: string;
};

export type FilesHandlerError = {
  code: ErrorCode | FileDeletedError['code'];
  message: string;
};

export type FilesHandlerFailure = {
  ok: false;
  status: number;
  error: FilesHandlerError;
  deletedAt?: string;
};

export type ReadFileByKeySuccess = {
  ok: true;
  data: FileReadResponse['data'];
  etag: string;
};

export type ReadFileByKeyResult = ReadFileByKeySuccess | FilesHandlerFailure;

export type GetFileStatsByKeySuccess = {
  ok: true;
  data: FileStatsData;
};

export type GetFileStatsByKeyResult = GetFileStatsByKeySuccess | FilesHandlerFailure;

export type GetAppendByKeySuccess = {
  ok: true;
  data: Append;
};

export type GetAppendByKeyResult = GetAppendByKeySuccess | FilesHandlerFailure;
