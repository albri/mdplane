import type {
  CopyFileToFolderRequest,
  CreateFileRequest,
  FolderBulkCreateRequest,
  FolderCreateRequest,
  FolderDeleteRequest,
  FolderMoveRequest,
  FolderRenameRequest,
  FolderDeleteResponse as FolderDeleteResponseType,
  FolderMoveResponse as FolderMoveResponseType,
  Error as ApiError,
} from '@mdplane/shared';
import type { HandlerResponse } from '../../shared';

export type FolderMutationsRouteDeps = {
  handleCreateFileInFolder: (input: {
    key: string;
    folderPathParam: string;
    body: CreateFileRequest;
    idempotencyKey: string | null;
    request: Request;
  }) => Promise<HandlerResponse>;
  handleCopyFileToFolder: (input: {
    key: string;
    folderPathParam: string;
    body: CopyFileToFolderRequest;
    request: Request;
  }) => Promise<HandlerResponse>;
  handleBulkCreateFiles: (input: {
    key: string;
    folderPathParam: string;
    body: FolderBulkCreateRequest;
    asyncMode: boolean;
    request: Request;
  }) => Promise<HandlerResponse>;
  handleCreateFolder: (input: {
    key: string;
    body: FolderCreateRequest;
    request: Request;
    idempotencyKey?: string | null;
  }) => Promise<HandlerResponse>;
  handleRenameFolder: (input: {
    key: string;
    folderPathParam: string;
    body: FolderRenameRequest;
    request: Request;
    idempotencyKey?: string | null;
  }) => Promise<HandlerResponse<FolderMoveResponseType | ApiError>>;
  handleDeleteFolder: (input: {
    key: string;
    folderPathParam: string;
    body: FolderDeleteRequest | undefined;
    request: Request;
    idempotencyKey?: string | null;
  }) => Promise<HandlerResponse<FolderDeleteResponseType | ApiError>>;
  handleMoveFolder: (input: {
    key: string;
    sourcePathParam: string;
    body: FolderMoveRequest;
    request: Request;
    idempotencyKey?: string | null;
  }) => Promise<HandlerResponse<FolderMoveResponseType | ApiError>>;
};

