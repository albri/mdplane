import type { ChangelogResponse, ExtractData } from '@mdplane/shared';

export type ChangelogData = ExtractData<ChangelogResponse>;
export type VersionEntry = ChangelogData['entries'][number];
export type ChangeEntry = VersionEntry['changes'][number];
export type ChangeType = ChangeEntry['type'];
