/**
 * API client for mdplane server.
 * Provides typed methods for all API operations.
 */
import type { AppendType } from '@mdplane/shared';
import {
  API_V1_ROUTES,
  CAPABILITY_ROUTES,
  FOLDER_ROUTES,
  SYSTEM_ROUTES,
} from '@mdplane/shared';

import { apiRequest, buildHeaders, type ApiResponse } from './request.js';
import type {
  ApiClientOptions,
  ApiFileDeleteResponse,
  ApiFileMoveResponse,
  ApiFileReadResponse,
  ApiFileSettings,
  ApiFileSettingsUpdateRequest,
  ApiFileUpdateResponse,
  ApiFileRecoverResponse,
  ApiFolderCreateResponse,
  ApiFolderDeleteResponse,
  ApiFolderListResponse,
  ApiRotateUrlsResponse,
  AppendData,
  AppendResponse,
  AgentLivenessResponse,
  BootstrapResponse,
  CapabilitiesCheckResponse,
  ClaimResponse,
  DeletedFilesResponse,
  ExportJobResponse,
  ExportJobStatusResponse,
  ExportResponse,
  FileMetaResponse,
  FileResponse,
  FileSectionResponse,
  FileStructureResponse,
  FileTailResponse,
  FolderContentsResponse,
  SearchResponse,
  WriteKeyStatsResponse,
} from './types.js';

export class ApiClient {
  private readonly baseUrl: string;
  private readonly sessionToken: string | undefined;
  private readonly apiKey: string | undefined;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.sessionToken = options.sessionToken;
    this.apiKey = options.apiKey;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return buildHeaders({ apiKey: this.apiKey, sessionToken: this.sessionToken }, extra);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    return apiRequest<T>({
      baseUrl: this.baseUrl,
      auth: { apiKey: this.apiKey, sessionToken: this.sessionToken },
      method,
      path,
      body,
      ...(extraHeaders != null ? { extraHeaders } : {}),
    });
  }

  private capabilityPath(basePath: string, filePath?: string): string {
    if (filePath == null || filePath.trim() === '') {
      return basePath;
    }

    const normalizedPath = filePath
      .trim()
      .replace(/^\/+/, '')
      .split('/')
      .filter((segment) => segment !== '')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    if (normalizedPath === '') {
      return basePath;
    }

    return `${basePath}/${normalizedPath}`;
  }

  async bootstrap(workspaceName?: string): Promise<BootstrapResponse> {
    const resolvedWorkspaceName = workspaceName != null && workspaceName !== ''
      ? workspaceName
      : `workspace-${String(Date.now())}`;

    return this.request<BootstrapResponse>(
      'POST',
      API_V1_ROUTES.bootstrap,
      { workspaceName: resolvedWorkspaceName }
    );
  }

  async claimWorkspace(writeKey: string): Promise<ClaimResponse> {
    return this.request<ClaimResponse>('POST', CAPABILITY_ROUTES.writeClaim(writeKey), {});
  }

  async checkCapabilities(keys: string[]): Promise<CapabilitiesCheckResponse> {
    return this.request<CapabilitiesCheckResponse>(
      'POST',
      SYSTEM_ROUTES.capabilitiesCheck,
      { keys }
    );
  }

  async checkCapabilitiesInWorkspace(
    workspaceKey: string,
    keys: string[]
  ): Promise<CapabilitiesCheckResponse> {
    return this.request<CapabilitiesCheckResponse>(
      'POST',
      CAPABILITY_ROUTES.writeCapabilitiesCheck(workspaceKey),
      { keys }
    );
  }

  async getFile(readKey: string, filePath?: string): Promise<FileResponse> {
    return this.request<FileResponse>(
      'GET',
      this.capabilityPath(CAPABILITY_ROUTES.read(readKey), filePath)
    );
  }

  async getFileRaw(readKey: string): Promise<string> {
    const url = `${this.baseUrl}${API_V1_ROUTES.readRaw(readKey)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const json = await response.json() as { error?: { message?: string } };
      throw new Error(json.error?.message ?? `Request failed: ${String(response.status)}`);
    }

    return response.text();
  }

  async getFileMeta(readKey: string): Promise<FileMetaResponse> {
    return this.request<FileMetaResponse>('GET', API_V1_ROUTES.readMeta(readKey));
  }

  async getFileTail(readKey: string, options?: { bytes?: number; limit?: number }): Promise<FileTailResponse> {
    const params = new URLSearchParams();
    if (options?.bytes != null) params.append('bytes', options.bytes.toString());
    if (options?.limit != null) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    return this.request<FileTailResponse>(
      'GET',
      `${API_V1_ROUTES.readTail(readKey)}${queryString ? `?${queryString}` : ''}`
    );
  }

  async getFileStructure(readKey: string): Promise<FileStructureResponse> {
    return this.request<FileStructureResponse>('GET', API_V1_ROUTES.readStructure(readKey));
  }

  async getFileSection(readKey: string, heading: string): Promise<FileSectionResponse> {
    return this.request<FileSectionResponse>('GET', API_V1_ROUTES.readSection(readKey, heading));
  }

  async getAppend(readKey: string, appendId: string): Promise<AppendData> {
    return this.request<AppendData>('GET', API_V1_ROUTES.readAppend(readKey, appendId));
  }

  async listFolder(
    readKey: string,
    folderPath?: string,
    options?: {
      sort?: 'name' | 'modified' | 'size';
      order?: 'asc' | 'desc';
    }
  ): Promise<FolderContentsResponse> {
    const params = new URLSearchParams();
    if (options?.sort) params.append('sort', options.sort);
    if (options?.order) params.append('order', options.order);
    const queryString = params.toString();
    const url = `${API_V1_ROUTES.readFolders(readKey, folderPath ?? undefined)}${queryString !== '' ? `?${queryString}` : ''}`;
    return this.request<FolderContentsResponse>('GET', url);
  }

  async append(
    appendKey: string,
    options: {
      content: string;
      path?: string | undefined;
      type?: AppendType | undefined;
      author?: string | undefined;
      ref?: string | undefined;
      priority?: 'low' | 'medium' | 'high' | 'critical' | undefined;
      labels?: string[] | undefined;
      dueAt?: string | undefined;
      value?: '+1' | '-1' | undefined;
    }
  ): Promise<AppendResponse> {
    const body: Record<string, unknown> = {
      content: options.content,
      type: options.type ?? 'comment',
      author: options.author ?? 'cli',
    };
    if (options.ref != null && options.ref !== '') {
      body.ref = options.ref;
    }
    if (options.priority != null) {
      body.priority = options.priority;
    }
    if (options.labels != null && options.labels.length > 0) {
      body.labels = options.labels;
    }
    if (options.dueAt != null && options.dueAt !== '') {
      body.dueAt = options.dueAt;
    }
    if (options.value != null) {
      body.value = options.value;
    }
    const appendPath = options.path != null && options.path !== ''
      ? this.capabilityPath(CAPABILITY_ROUTES.byKeyType('a', appendKey), options.path)
      : CAPABILITY_ROUTES.append(appendKey);

    return this.request<AppendResponse>('POST', appendPath, body);
  }

  /**
   * Get stats for write key scope (file, folder, or workspace).
   * Uses /w/{key}/ops/stats endpoint.
   */
  async getWriteKeyStats(writeKey: string): Promise<WriteKeyStatsResponse> {
    return this.request<WriteKeyStatsResponse>('GET', CAPABILITY_ROUTES.writeStats(writeKey));
  }

  async updateFile(opts: {
    writeKey: string;
    path?: string;
    content: string;
    etag?: string;
  }): Promise<ApiFileUpdateResponse> {
    const headers: Record<string, string> = {};
    if (opts.etag != null && opts.etag !== '') {
      headers['If-Match'] = opts.etag;
    }
    return this.request<ApiFileUpdateResponse>(
      'PUT',
      this.capabilityPath(CAPABILITY_ROUTES.write(opts.writeKey), opts.path),
      { content: opts.content },
      headers
    );
  }

  async deleteFile(writeKey: string, permanent = false, filePath?: string): Promise<ApiFileDeleteResponse> {
    const queryParam = permanent ? '?permanent=true' : '';
    return this.request<ApiFileDeleteResponse>(
      'DELETE',
      `${this.capabilityPath(CAPABILITY_ROUTES.write(writeKey), filePath)}${queryParam}`
    );
  }

  async recoverFile(writeKey: string, rotateUrls = false): Promise<ApiFileRecoverResponse> {
    const queryParam = rotateUrls ? '?rotateUrls=true' : '';
    return this.request<ApiFileRecoverResponse>(
      'POST',
      `${CAPABILITY_ROUTES.writeRecover(writeKey)}${queryParam}`
    );
  }

  async moveFile(opts: {
    writeKey: string;
    source: string;
    destination: string;
  }): Promise<ApiFileMoveResponse> {
    return this.request<ApiFileMoveResponse>(
      'POST',
      CAPABILITY_ROUTES.writeMove(opts.writeKey),
      { source: opts.source, destination: opts.destination }
    );
  }

  async rotateUrls(writeKey: string): Promise<ApiRotateUrlsResponse> {
    return this.request<ApiRotateUrlsResponse>(
      'POST',
      CAPABILITY_ROUTES.writeRotate(writeKey)
    );
  }

  async getFileSettings(writeKey: string): Promise<ApiFileSettings> {
    return this.request<ApiFileSettings>(
      'GET',
      CAPABILITY_ROUTES.writeSettings(writeKey)
    );
  }

  async updateFileSettings(writeKey: string, settings: ApiFileSettingsUpdateRequest): Promise<ApiFileSettings> {
    return this.request<ApiFileSettings>(
      'PATCH',
      CAPABILITY_ROUTES.writeSettings(writeKey),
      settings
    );
  }

  async readFileByPath(path: string): Promise<ApiFileReadResponse> {
    return this.request<ApiFileReadResponse>('GET', API_V1_ROUTES.file(path));
  }

  async writeFileByPath(opts: {
    path: string;
    content: string;
    etag?: string;
  }): Promise<ApiFileUpdateResponse> {
    const headers: Record<string, string> = {};
    if (opts.etag != null && opts.etag !== '') {
      headers['If-Match'] = opts.etag;
    }
    return this.request<ApiFileUpdateResponse>(
      'PUT',
      API_V1_ROUTES.file(opts.path),
      { content: opts.content },
      headers
    );
  }

  async deleteFileByPath(path: string, permanent = false): Promise<ApiFileDeleteResponse> {
    const queryParam = permanent ? '?permanent=true' : '';
    return this.request<ApiFileDeleteResponse>(
      'DELETE',
      `${API_V1_ROUTES.file(path)}${queryParam}`
    );
  }

  async appendToFileByPath(
    path: string,
    options: {
      content: string;
      type?: AppendType | undefined;
      author?: string | undefined;
      ref?: string | undefined;
    }
  ): Promise<AppendResponse> {
    const body: Record<string, unknown> = {
      content: options.content,
      type: options.type ?? 'comment',
      author: options.author ?? 'cli',
    };
    if (options.ref != null && options.ref !== '') {
      body.ref = options.ref;
    }
    return this.request<AppendResponse>(
      'POST',
      API_V1_ROUTES.fileAppend(path),
      body
    );
  }

  async listFolderByPath(path?: string): Promise<ApiFolderListResponse> {
    return this.request<ApiFolderListResponse>('GET', API_V1_ROUTES.folders(path ?? undefined));
  }

  async createFolder(path?: string, name?: string): Promise<ApiFolderCreateResponse> {
    if (name == null || name === '') {
      throw new Error('Folder name is required');
    }
    return this.request<ApiFolderCreateResponse>('POST', API_V1_ROUTES.folders(path ?? undefined), { name });
  }

  async deleteFolderByPath(path: string): Promise<ApiFolderDeleteResponse> {
    return this.request<ApiFolderDeleteResponse>(
      'DELETE',
      API_V1_ROUTES.folders(path)
    );
  }

  async createFolderViaCapability(opts: {
    writeKey: string;
    name: string;
    parentPath?: string;
  }): Promise<ApiFolderCreateResponse> {
    if (opts.name === '') {
      throw new Error('Folder name is required');
    }
    const body: { name: string; path?: string } = { name: opts.name };
    if (opts.parentPath != null && opts.parentPath !== '') {
      body.path = opts.parentPath;
    }
    return this.request<ApiFolderCreateResponse>('POST', FOLDER_ROUTES.create(opts.writeKey), body);
  }

  async deleteFolderViaCapability(writeKey: string, path: string): Promise<ApiFolderDeleteResponse> {
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');
    return this.request<ApiFolderDeleteResponse>(
      'DELETE',
      FOLDER_ROUTES.delete(writeKey, normalizedPath)
    );
  }

  async searchWorkspace(query: string, options?: {
    type?: string;
    folder?: string;
    status?: string;
    author?: string;
    labels?: string;
    priority?: string;
    since?: string;
    limit?: number;
    cursor?: string;
  }): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options?.type != null) params.append('type', options.type);
    if (options?.folder != null) params.append('folder', options.folder);
    if (options?.status != null) params.append('status', options.status);
    if (options?.author != null) params.append('author', options.author);
    if (options?.labels != null) params.append('labels', options.labels);
    if (options?.priority != null) params.append('priority', options.priority);
    if (options?.since != null) params.append('since', options.since);
    if (options?.limit != null) params.append('limit', options.limit.toString());
    if (options?.cursor != null) params.append('cursor', options.cursor);

    const queryString = params.toString();
    return this.request<SearchResponse>(
      'GET',
      `${API_V1_ROUTES.search}${queryString ? `?${queryString}` : ''}`
    );
  }

  async searchViaCapability(readKey: string, query: string, options?: {
    type?: string;
    status?: string;
    author?: string;
    labels?: string;
    priority?: string;
    since?: string;
    limit?: number;
    cursor?: string;
  }): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options?.type != null) params.append('type', options.type);
    if (options?.status != null) params.append('status', options.status);
    if (options?.author != null) params.append('author', options.author);
    if (options?.labels != null) params.append('labels', options.labels);
    if (options?.priority != null) params.append('priority', options.priority);
    if (options?.since != null) params.append('since', options.since);
    if (options?.limit != null) params.append('limit', options.limit.toString());
    if (options?.cursor != null) params.append('cursor', options.cursor);

    const queryString = params.toString();
    return this.request<SearchResponse>(
      'GET',
      `${CAPABILITY_ROUTES.readSearch(readKey)}${queryString ? `?${queryString}` : ''}`
    );
  }

  async exportWorkspace(options?: {
    format?: 'zip' | 'tar.gz';
    includeAppends?: boolean;
    includeDeleted?: boolean;
    paths?: string;
  }): Promise<ExportResponse> {
    const params = new URLSearchParams();
    if (options?.format != null) params.append('format', options.format);
    if (options?.includeAppends != null) params.append('includeAppends', options.includeAppends.toString());
    if (options?.includeDeleted != null) params.append('includeDeleted', options.includeDeleted.toString());
    if (options?.paths != null) params.append('paths', options.paths);

    const queryString = params.toString();

    const url = `${this.baseUrl}${API_V1_ROUTES.export}${queryString ? `?${queryString}` : ''}`;
    const requestOptions: RequestInit = {
      method: 'GET',
      headers: this.headers(),
    };

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const json = (await response.json()) as ApiResponse<unknown>;
      throw new Error(json.error?.message ?? `Export failed: ${response.status.toString()}`);
    }

    const blob = await response.blob();
    const checksum = response.headers.get('X-Export-Checksum');

    return {
      blob,
      checksum: checksum ?? null,
    };
  }

  async createExportJob(options?: {
    format?: 'zip' | 'tar.gz';
    includeAppends?: boolean;
    includeDeleted?: boolean;
    paths?: string[];
    notifyEmail?: string;
  }): Promise<ExportJobResponse> {
    return this.request<ExportJobResponse>(
      'POST',
      API_V1_ROUTES.exportJobs,
      options != null ? {
        format: options.format ?? 'zip',
        includeAppends: options.includeAppends ?? false,
        includeDeleted: options.includeDeleted ?? false,
        ...(options.paths != null ? { paths: options.paths } : {}),
        ...(options.notifyEmail != null ? { notifyEmail: options.notifyEmail } : {}),
      } : undefined
    );
  }

  async getExportJobStatus(jobId: string): Promise<ExportJobStatusResponse> {
    return this.request<ExportJobStatusResponse>(
      'GET',
      API_V1_ROUTES.exportJob(jobId)
    );
  }

  async downloadExportJob(jobId: string): Promise<ExportResponse> {
    const url = `${this.baseUrl}${API_V1_ROUTES.exportJobDownload(jobId)}`;
    const requestOptions: RequestInit = {
      method: 'GET',
      headers: this.headers(),
    };

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const json = (await response.json()) as { error?: { code: string; message: string } };
      throw new Error(json.error?.message ?? `Download failed: ${response.status.toString()}`);
    }

    const blob = await response.blob();
    const checksum = response.headers.get('X-Export-Checksum');

    return {
      blob,
      checksum: checksum ?? null,
    };
  }

  async getAgentLiveness(options?: {
    staleThresholdSeconds?: number;
    folder?: string;
  }): Promise<AgentLivenessResponse> {
    const params = new URLSearchParams();
    if (options?.staleThresholdSeconds != null) {
      params.append('staleThresholdSeconds', options.staleThresholdSeconds.toString());
    }
    if (options?.folder != null) {
      params.append('folder', options.folder);
    }

    const queryString = params.toString();
    return this.request<AgentLivenessResponse>(
      'GET',
      `${API_V1_ROUTES.agentLiveness}${queryString ? `?${queryString}` : ''}`
    );
  }

  async getDeletedFiles(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<DeletedFilesResponse> {
    const params = new URLSearchParams();
    if (options?.limit != null) {
      params.append('limit', options.limit.toString());
    }
    if (options?.cursor != null) {
      params.append('cursor', options.cursor);
    }

    const queryString = params.toString();
    return this.request<DeletedFilesResponse>(
      'GET',
      `${API_V1_ROUTES.deleted}${queryString ? `?${queryString}` : ''}`
    );
  }
}
