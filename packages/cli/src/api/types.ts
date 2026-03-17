import type {
  SearchResponse as GenSearchResponse,
  BootstrapResponse as GenBootstrapResponse,
  FileReadResponse as GenFileReadResponse,
  FileMetaResponse as GenFileMetaResponse,
  FileTailResponse as GenFileTailResponse,
  FileStructureResponse as GenFileStructureResponse,
  FileSectionResponse as GenFileSectionResponse,
  FileUpdateResponse as GenFileUpdateResponse,
  FileDeleteResponse as GenFileDeleteResponse,
  FileRecoverResponse as GenFileRecoverResponse,
  FileMoveResponse as GenFileMoveResponse,
  FileRotateUrlsResponse as GenFileRotateUrlsResponse,
  FolderListResponse as GenFolderListResponse,
  FolderCreateResponse as GenFolderCreateResponse,
  FolderDeleteResponse as GenFolderDeleteResponse,
  AgentLivenessResponse as GenAgentLivenessResponse,
  DeletedFilesListResponse as GenDeletedFilesListResponse,
  ExportJobCreateResponse as GenExportJobCreateResponse,
  ExportJobStatusResponse as GenExportJobStatusResponse,
  CapabilitiesCheckResponse as GenCapabilitiesCheckResponse,
  ClaimWorkspaceResponse as GenClaimWorkspaceResponse,
  StatsViaWriteKeyResponse as GenStatsViaWriteKeyResponse,
  SearchResult,
  AgentLiveness,
  DeletedFileEntry,
  CapabilityCheckResult,
  FileSettings,
  FileSettingsUpdateRequest,
  SingleAppendResult,
  PaginatedResponse,
  FolderItem,
  CapabilityUrls,
  ExtractData,
} from '@mdplane/shared';

export type { SearchResult };

export type SearchResponse = ExtractData<GenSearchResponse> & {
  pagination?: PaginatedResponse;
};

export interface ExportResponse {
  blob: Blob;
  checksum: string | null;
}

export type ExportJobResponse = ExtractData<GenExportJobCreateResponse>;

export type ExportJobStatusResponse = ExtractData<GenExportJobStatusResponse>;

export type AgentLivenessData = AgentLiveness;

export type AgentLivenessResponse = ExtractData<GenAgentLivenessResponse>;

export type DeletedFileData = DeletedFileEntry;

export type DeletedFilesResponse = ExtractData<GenDeletedFilesListResponse> & {
  pagination?: PaginatedResponse;
};

export interface ApiClientOptions {
  baseUrl: string;
  sessionToken?: string | undefined;
  apiKey?: string | undefined;
}

export type BootstrapResponse = ExtractData<GenBootstrapResponse>;

export type FileResponse = ExtractData<GenFileReadResponse>;

export type FolderContentsResponse = ExtractData<GenFolderListResponse>;

export type AppendResponse = SingleAppendResult;

export type { FolderItem, CapabilityUrls };

export type FileMetaResponse = ExtractData<GenFileMetaResponse>;

export type FileTailResponse = ExtractData<GenFileTailResponse>;

export type FileStructureResponse = ExtractData<GenFileStructureResponse>;

export type FileSectionResponse = ExtractData<GenFileSectionResponse>;

export type AppendData = SingleAppendResult;

export type ApiFileReadResponse = ExtractData<GenFileReadResponse>;

export type ApiFileUpdateResponse = ExtractData<GenFileUpdateResponse>;

export type ApiFileDeleteResponse = ExtractData<GenFileDeleteResponse>;

export type ApiFileRecoverResponse = ExtractData<GenFileRecoverResponse>;

export type ApiFileMoveResponse = ExtractData<GenFileMoveResponse>;

export type ApiRotateUrlsResponse = ExtractData<GenFileRotateUrlsResponse>;

export type ApiFileSettings = FileSettings;

export type ApiFileSettingsUpdateRequest = FileSettingsUpdateRequest;

export type ApiFolderListResponse = ExtractData<GenFolderListResponse>;

export type ApiFolderCreateResponse = ExtractData<GenFolderCreateResponse>;

export type ApiFolderDeleteResponse = ExtractData<GenFolderDeleteResponse>;

export type ClaimResponse = ExtractData<GenClaimWorkspaceResponse>;

export type { CapabilityCheckResult };

export type CapabilitiesCheckResponse = ExtractData<GenCapabilitiesCheckResponse>;

export type WriteKeyStatsResponse = ExtractData<GenStatsViaWriteKeyResponse>;
