import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '@/types/profile';
import { createDefaultProfile, getProfile, saveProfile } from '@/lib/profile';
import {
  CLOUD_SYNC_STORAGE_KEY,
  createDefaultCloudSyncSettings,
  type CloudSyncSettings,
} from '@/types/cloud-sync';

type UseProfileState = {
  profile: Profile;
  loading: boolean;
  saving: boolean;
  error: string | null;
  dirty: boolean;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  reload: () => Promise<void>;
  persist: () => Promise<boolean>;
  markDirty: () => void;
};

async function loadCloudSettings(): Promise<CloudSyncSettings> {
  const result = await chrome.storage.local.get(CLOUD_SYNC_STORAGE_KEY);
  const stored = result[CLOUD_SYNC_STORAGE_KEY] as Partial<CloudSyncSettings> | undefined;
  return { ...createDefaultCloudSyncSettings(), ...(stored ?? {}) };
}

/** If cloud-primary is enabled, pull from cloud via background worker. */
async function tryCloudPull(): Promise<Profile | null> {
  try {
    const settings = await loadCloudSettings();
    if (!settings.enabled || !settings.cloudPrimary) return null;

    const response = (await chrome.runtime.sendMessage({ type: 'CLOUD_PULL' })) as {
      ok: boolean;
      profile?: Profile;
      error?: string;
    };

    if (response.ok && response.profile) {
      return response.profile;
    }
  } catch {
    // silently fall back to local
  }
  return null;
}

export function useProfile(): UseProfileState {
  const [profile, setProfile] = useState<Profile>(createDefaultProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load local first (fast)
      const local = await getProfile();
      setProfile(local);

      // Then attempt cloud pull if cloud-primary is on (async override)
      const cloud = await tryCloudPull();
      if (cloud) {
        setProfile(cloud);
      }

      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persist = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProfile(profile);
      setProfile(saved);
      setDirty(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [profile]);

  const markDirty = useCallback(() => setDirty(true), []);

  return {
    profile,
    loading,
    saving,
    error,
    dirty,
    setProfile,
    reload,
    persist,
    markDirty,
  };
}
