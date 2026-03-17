import type {
  DeleteWorkspaceResponse,
  Error as ApiError,
  ExtractData,
  RotateAllResponse,
  WorkspaceRenameResponse,
} from '@mdplane/shared';

export type WorkspaceAccessError = {
  code: 'UNAUTHORIZED' | 'NOT_FOUND';
  message: string;
};

export type SessionOwnershipResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      status: number;
      error: WorkspaceAccessError;
    };

export type DeleteWorkspaceData = NonNullable<DeleteWorkspaceResponse['data']>;
export type RotateAllWorkspaceKeysData = ExtractData<RotateAllResponse>;
export type WorkspaceRenameData = ExtractData<WorkspaceRenameResponse>;
export type ApiErrorBody = NonNullable<ApiError['error']>;

export type DeleteWorkspaceResponseBody =
  | { ok: true; data: DeleteWorkspaceData }
  | { ok: false; error: ApiErrorBody };

export type RotateAllWorkspaceKeysResponseBody =
  | { ok: true; data: RotateAllWorkspaceKeysData }
  | { ok: false; error: ApiErrorBody };

export type WorkspaceRenameResponseBody =
  | { ok: true; data: WorkspaceRenameData }
  | { ok: false; error: ApiErrorBody };
