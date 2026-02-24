/**
 * CLI configuration types.
 */

export interface Profile {
  name: string;
  baseUrl: string;
  mode: 'capability' | 'api-key';
  capabilityUrls?: {
    read?: string;
    append?: string;
    write?: string;
  };
  apiKey?: string;
  workspaceId?: string;
  workspaceName?: string;
  webUrl?: string;
  claimed?: boolean;
}

export interface CliConfig {
  defaultProfile?: string;
  profiles: Record<string, Profile>;
}

export interface MdPlaneConfig {
  workspaceId?: string;
  workspaceName?: string;
  readKey?: string;
  appendKey?: string;
  writeKey?: string;
  apiUrl?: string;
  apiKey?: string;
  sessionToken?: string;
  claimed?: boolean;
}

export interface CommandContext {
  profile: Profile;
  apiUrl: string;
  apiKey: string | undefined;
  keys: {
    readKey: string | undefined;
    appendKey: string | undefined;
    writeKey: string | undefined;
  };
}

