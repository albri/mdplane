/**
 * CLI-specific API type aliases.
 * Re-exports and transforms types from @mdplane/shared for CLI use.
 */
import type {
  // Response envelope types (use with ExtractData<T>)
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
  // Direct types (no envelope)
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
  // Type helper
  ExtractData,
} from '@mdplane/shared';

/** Re-export SearchResult for CLI consumers */
export type { SearchResult };

/** Search response data (unwrapped from envelope) */
export type SearchResponse = ExtractData<GenSearchResponse> & {
  pagination?: PaginatedResponse;
};

/** CLI-specific: Binary export response */
export interface ExportResponse {
  blob: Blob;
  checksum: string | null;
}

/** Export job creation response data */
export type ExportJobResponse = ExtractData<GenExportJobCreateResponse>;

/** Export job status response data */
export type ExportJobStatusResponse = ExtractData<GenExportJobStatusResponse>;

/** Agent liveness data (single agent) - alias for generated type */
export type AgentLivenessData = AgentLiveness;

/** Agent liveness response data */
export type AgentLivenessResponse = ExtractData<GenAgentLivenessResponse>;

/** Deleted file entry - alias for generated type */
export type DeletedFileData = DeletedFileEntry;

/** Deleted files list response data */
export type DeletedFilesResponse = ExtractData<GenDeletedFilesListResponse> & {
  pagination?: PaginatedResponse;
};

/** CLI-specific: API client configuration */
export interface ApiClientOptions {
  baseUrl: string;
  sessionToken?: string | undefined;
  apiKey?: string | undefined;
}

/** Bootstrap response data */
export type BootstrapResponse = ExtractData<GenBootstrapResponse>;

/** File read response data - alias for capability URL read */
export type FileResponse = ExtractData<GenFileReadResponse>;

/** Folder contents response data */
export type FolderContentsResponse = ExtractData<GenFolderListResponse>;

/** Single append result - returned by append operations */
export type AppendResponse = SingleAppendResult;

/** Re-export FolderItem for CLI consumers */
export type { FolderItem, CapabilityUrls };

/** File metadata response data */
export type FileMetaResponse = ExtractData<GenFileMetaResponse>;

/** File tail response data */
export type FileTailResponse = ExtractData<GenFileTailResponse>;

/** File structure response data */
export type FileStructureResponse = ExtractData<GenFileStructureResponse>;

/** File section response data */
export type FileSectionResponse = ExtractData<GenFileSectionResponse>;

/** Full append object - alias for SingleAppendResult */
export type AppendData = SingleAppendResult;

/** API file read response (via API key) */
export type ApiFileReadResponse = ExtractData<GenFileReadResponse>;

/** API file update response */
export type ApiFileUpdateResponse = ExtractData<GenFileUpdateResponse>;

/** API file delete response */
export type ApiFileDeleteResponse = ExtractData<GenFileDeleteResponse>;

/** API file recover response */
export type ApiFileRecoverResponse = ExtractData<GenFileRecoverResponse>;

/** API file move response */
export type ApiFileMoveResponse = ExtractData<GenFileMoveResponse>;

/** API rotate URLs response */
export type ApiRotateUrlsResponse = ExtractData<GenFileRotateUrlsResponse>;

/** File settings - re-export from generated types */
export type ApiFileSettings = FileSettings;

/** File settings update request - re-export from generated types */
export type ApiFileSettingsUpdateRequest = FileSettingsUpdateRequest;

/** API folder list response */
export type ApiFolderListResponse = ExtractData<GenFolderListResponse>;

/** API folder create response */
export type ApiFolderCreateResponse = ExtractData<GenFolderCreateResponse>;

/** API folder delete response */
export type ApiFolderDeleteResponse = ExtractData<GenFolderDeleteResponse>;

/** Claim workspace response */
export type ClaimResponse = ExtractData<GenClaimWorkspaceResponse>;

/** Re-export CapabilityCheckResult for CLI consumers */
export type { CapabilityCheckResult };

/** Capabilities check response data */
export type CapabilitiesCheckResponse = ExtractData<GenCapabilitiesCheckResponse>;

/**
 * Write key stats response data (unwrapped from envelope).
 * Returned by /w/{key}/ops/stats endpoint.
 */
export type WriteKeyStatsResponse = ExtractData<GenStatsViaWriteKeyResponse>;
