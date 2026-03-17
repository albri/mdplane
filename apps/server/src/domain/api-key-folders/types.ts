import type {
  ExtractData,
  FolderCreateResponse,
  FolderDeleteResponse,
  FolderListResponse,
} from '@mdplane/shared';

export type Scope = 'read' | 'append' | 'write' | 'export';

export type ListFolderInput = {
  workspaceId: string;
  folderPath: string;
  appUrl: string;
};

export type ListFolderData = ExtractData<FolderListResponse>;

export type ListFolderResult =
  | { ok: true; data: ListFolderData }
  | { ok: false; status: number; error: { code: string; message?: string } };

export type CreateFolderInput = {
  workspaceId: string;
  parentPath: string;
  folderName: string;
};

export type CreateFolderResult =
  | { ok: true; data: ExtractData<FolderCreateResponse> }
  | { ok: false; status: number; error: { code: string; message: string } };

export type DeleteFolderInput = {
  workspaceId: string;
  folderPath: string;
  recursive: boolean;
};

export type DeleteFolderResult =
  | { ok: true; data: ExtractData<FolderDeleteResponse> }
  | { ok: false; status: number; error: { code: string; message: string } };

export type PathValidationResult =
  | { ok: true; path: string }
  | { ok: false; status: number; error: { code: string; message: string } };

