import type { Error as ApiError } from '@mdplane/shared';
import { zError } from '@mdplane/shared';

export type ErrorCode = ApiError['error']['code'];

export type ErrorResponse = {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<T> = { ok: true; data: T } | ErrorResponse;

export function createErrorResponse<C extends ErrorCode>(
  code: C,
  message: string,
  details?: Record<string, unknown>
) {
  if (details) {
    return {
      ok: false as const,
      error: { code, message, details },
    };
  }
  return {
    ok: false as const,
    error: { code, message },
  };
}

export function createError(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>
): ErrorResponse['error'] {
  const error: ErrorResponse['error'] = {
    code,
    message: message ?? getDefaultMessage(code),
  };
  if (details) {
    error.details = details;
  }
  return error;
}

function getDefaultMessage(code: ErrorCode): string {
  const messages: Partial<Record<ErrorCode, string>> = {
    FILE_NOT_FOUND: 'File not found',
    FOLDER_NOT_FOUND: 'Folder not found',
    WORKSPACE_NOT_FOUND: 'Workspace not found',
    APPEND_NOT_FOUND: 'Append not found',
    WEBHOOK_NOT_FOUND: 'Webhook not found',
    FILE_DELETED: 'File has been deleted',
    INVALID_REQUEST: 'Invalid request',
    INVALID_PATH: 'Invalid path',
    INVALID_KEY: 'Invalid capability key',
    INVALID_AUTHOR: 'Invalid author',
    PERMISSION_DENIED: 'Permission denied',
    KEY_EXPIRED: 'Key has expired',
    KEY_REVOKED: 'Key has been revoked',
    KEY_NOT_FOUND: 'Key not found',
    NOT_FOUND: 'Not found',
    RATE_LIMITED: 'Rate limit exceeded',
    UNAUTHORIZED: 'Unauthorized',
    SERVER_ERROR: 'Internal server error',
  };
  return messages[code] ?? code;
}

export function isValidErrorCode(code: unknown): code is ErrorCode {
  const result = zError.shape.error.shape.code.safeParse(code);
  return result.success;
}

export function assertErrorCode(code: string): asserts code is ErrorCode {
  if (!isValidErrorCode(code)) {
    throw new Error(`Invalid error code: ${code}`);
  }
}

