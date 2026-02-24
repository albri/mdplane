export {
  handleGetFile,
  handleAppendToFile,
  handleCreateOrWriteFile,
  handleUpdateFile,
  handleDeleteFile,
} from './handlers';
export { createApiKeyFilesRoute } from './route';

export type {
  Scope,
  AuthenticatedKey,
  GetFileInput,
  GetFileResult,
  AppendToFileInput,
  AppendToFileResult,
  CreateFileInput,
  CreateFileResult,
  UpdateFileInput,
  UpdateFileResult,
  DeleteFileInput,
  DeleteFileResult,
} from './types';
