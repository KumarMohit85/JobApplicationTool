export const CLOUD_SYNC_STORAGE_KEY = 'applykit_cloud_sync';

export type CloudProvider = 'github_gist' | 'github_repo' | 'url';

export type CloudSyncSettings = {
  /** When true, profile is loaded from cloud on startup and saved to cloud on persist. */
  enabled: boolean;
  provider: CloudProvider;
  /** Keep a local copy in chrome.storage for offline fallback. */
  cacheLocally: boolean;
  /** When true, do not persist profile JSON locally (cloud is source of truth). */
  cloudPrimary: boolean;
  gistId?: string;
  owner?: string;
  repo?: string;
  path?: string;
  branch?: string;
  profileUrl?: string;
  lastSyncedAt?: string;
};

export const GITHUB_TOKEN_STORAGE_KEY = 'applykit_github_token';

export function createDefaultCloudSyncSettings(): CloudSyncSettings {
  return {
    enabled: false,
    provider: 'github_gist',
    cacheLocally: true,
    cloudPrimary: false,
    path: 'applykit-profile.json',
    branch: 'main',
  };
}
