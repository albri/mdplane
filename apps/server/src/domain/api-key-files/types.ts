import type { HandlerResponse } from '../../shared/types';
import type {
  ExtractData,
  FileCreateResponse,
  FileDeleteResponse,
  FileReadResponse,
  FileUpdateResponse,
  SingleAppendResult,
} from '@mdplane/shared';

export type Scope = 'read' | 'append' | 'write' | 'export';

export type AuthenticatedKey = {
  id: string;
  workspaceId: string;
  scopes: Scope[];
};

export type GetFileInput = {
  key: AuthenticatedKey;
  path: string;
};

export type GetFileData = ExtractData<FileReadResponse>;

export type GetFileResult = HandlerResponse<
  | { ok: true; data: GetFileData }
  | { ok: false; error: { code: string; message: string } }
>;

export type AppendToFileInput = {
  key: AuthenticatedKey;
  path: string;
  body: unknown;
};

export type AppendToFileData = Omit<SingleAppendResult, 'type'> & {
  type: string;
  content: string;
};

export type AppendToFileResult = HandlerResponse<
  | { ok: true; data: AppendToFileData }
  | { ok: false; error: { code: string; message: string } }
>;

export type CreateFileInput = {
  key: AuthenticatedKey;
  path: string;
  body: unknown;
  baseUrl: string;
  appUrl: string;
};

export type CreateNewFileData = ExtractData<FileCreateResponse>;
export type OverwriteExistingFileData = Pick<ExtractData<FileReadResponse>, 'id' | 'filename'> & {
  path: string;
  updatedAt: string;
};
export type CreateFileData = CreateNewFileData | OverwriteExistingFileData;

export type CreateFileResult = HandlerResponse<
  | { ok: true; data: CreateFileData }
  | { ok: false; error: { code: string; message: string } }
>;

export type UpdateFileInput = {
  key: AuthenticatedKey;
  path: string;
  body: unknown;
  ifMatchHeader: string | null;
  appUrl: string;
};

export type UpdateFileData = ExtractData<FileUpdateResponse>;

export type UpdateFileResult = HandlerResponse<
  | { ok: true; data: UpdateFileData }
  | { ok: false; error: { code: string; message: string; details?: Record<string, string> } }
>;

export type DeleteFileInput = {
  key: AuthenticatedKey;
  path: string;
  permanent: boolean;
};

export type DeleteFileData = ExtractData<FileDeleteResponse>;

export type DeleteFileResult = HandlerResponse<
  | { ok: true; data: DeleteFileData }
  | { ok: false; error: { code: string; message: string } }
>;
