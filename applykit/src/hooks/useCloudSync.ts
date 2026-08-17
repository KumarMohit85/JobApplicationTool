import { useCallback, useEffect, useState } from 'react';
import {
  CLOUD_SYNC_STORAGE_KEY,
  GITHUB_TOKEN_STORAGE_KEY,
  createDefaultCloudSyncSettings,
  type CloudSyncSettings,
} from '@/types/cloud-sync';
import type { Profile } from '@/types/profile';

type CloudSyncOp = 'idle' | 'pushing' | 'pulling';

type UseCloudSyncState = {
  settings: CloudSyncSettings;
  githubToken: string;
  loading: boolean;
  op: CloudSyncOp;
  error: string | null;
  successMessage: string | null;
  setSettings: (partial: Partial<CloudSyncSettings>) => void;
  setGithubToken: (token: string) => void;
  save: () => Promise<boolean>;
  connect: (
    overrideToken?: string,
    overrideRepo?: string,
  ) => Promise<{ pulledProfile?: Profile } | null>;
  push: (profile: Profile) => Promise<boolean>;
  pull: () => Promise<{ profile: Profile } | null>;
  reload: () => Promise<void>;
};

export function useCloudSync(): UseCloudSyncState {
  const [settings, setSettingsState] = useState<CloudSyncSettings>(
    createDefaultCloudSyncSettings(),
  );
  const [githubToken, setGithubTokenState] = useState('');
  const [loading, setLoading] = useState(true);
  const [op, setOp] = useState<CloudSyncOp>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await chrome.storage.local.get([
        CLOUD_SYNC_STORAGE_KEY,
        GITHUB_TOKEN_STORAGE_KEY,
      ]);
      const stored = result[CLOUD_SYNC_STORAGE_KEY] as Partial<CloudSyncSettings> | undefined;
      setSettingsState({ ...createDefaultCloudSyncSettings(), ...(stored ?? {}) });
      setGithubTokenState((result[GITHUB_TOKEN_STORAGE_KEY] as string | undefined) ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cloud settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setSettings = useCallback((partial: Partial<CloudSyncSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...partial }));
    setError(null);
    setSuccessMessage(null);
  }, []);

  const setGithubToken = useCallback((token: string) => {
    setGithubTokenState(token);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setError(null);
    setSuccessMessage(null);
    try {
      await chrome.storage.local.set({
        [CLOUD_SYNC_STORAGE_KEY]: settings,
        [GITHUB_TOKEN_STORAGE_KEY]: githubToken,
      });
      setSuccessMessage('Cloud sync settings saved.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cloud settings.');
      return false;
    }
  }, [settings, githubToken]);

  const connect = useCallback(
    async (
      overrideToken?: string,
      overrideRepo?: string,
    ): Promise<{ pulledProfile?: Profile } | null> => {
      setOp('pulling');
      setError(null);
      setSuccessMessage(null);

      const targetToken = overrideToken || githubToken;
      const targetRepo = overrideRepo || settings.repo || 'applykit-backup';

      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'CLOUD_CONNECT',
          token: targetToken,
          repoName: targetRepo,
        })) as {
          ok: boolean;
          owner?: string;
          repo?: string;
          pulledProfile?: Profile;
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          setError(response.error ?? 'Connect failed.');
          return null;
        }

        await reload();
        setSuccessMessage(response.message || 'Connected to GitHub repository cloud sync!');
        return { pulledProfile: response.pulledProfile };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connect failed.');
        return null;
      } finally {
        setOp('idle');
      }
    },
    [githubToken, settings.repo, reload],
  );

  const push = useCallback(
    async (profile: Profile): Promise<boolean> => {
      setOp('pushing');
      setError(null);
      setSuccessMessage(null);
      await save();
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'CLOUD_PUSH',
          profile,
        })) as { ok: boolean; gistId?: string; error?: string };

        if (!response.ok) {
          setError(response.error ?? 'Push failed.');
          return false;
        }
        if (response.gistId && response.gistId !== settings.gistId) {
          setSettingsState((prev) => ({ ...prev, gistId: response.gistId }));
        }
        setSuccessMessage(`Profile pushed to cloud. Last synced: ${new Date().toLocaleTimeString()}`);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Push failed.');
        return false;
      } finally {
        setOp('idle');
      }
    },
    [save, settings.gistId],
  );

  const pull = useCallback(async (): Promise<{ profile: Profile } | null> => {
    setOp('pulling');
    setError(null);
    setSuccessMessage(null);
    await save();
    try {
      const response = (await chrome.runtime.sendMessage({ type: 'CLOUD_PULL' })) as {
        ok: boolean;
        profile?: Profile;
        error?: string;
      };

      if (!response.ok || !response.profile) {
        setError(response.error ?? 'Pull failed.');
        return null;
      }
      await reload();
      setSuccessMessage(
        `Profile pulled from cloud. Last synced: ${new Date().toLocaleTimeString()}`,
      );
      return { profile: response.profile };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed.');
      return null;
    } finally {
      setOp('idle');
    }
  }, [save, reload]);

  return {
    settings,
    githubToken,
    loading,
    op,
    error,
    successMessage,
    setSettings,
    setGithubToken,
    save,
    connect,
    push,
    pull,
    reload,
  };
}
