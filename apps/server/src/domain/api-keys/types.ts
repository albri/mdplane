export const VALID_API_KEY_SCOPES = ['read', 'append', 'write', 'export'] as const;

export type ApiKeyScope = (typeof VALID_API_KEY_SCOPES)[number];

export type SessionOwnershipResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: { code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'FORBIDDEN'; message: string } };

export type AuthenticateApiKeyRequestResult =
  | {
      ok: true;
      key: {
        id: string;
        workspaceId: string;
        scopes: ApiKeyScope[];
      };
    }
  | {
      ok: false;
      status: number;
      body: {
        ok: false;
        error: { code: string; message: string };
      };
    };
