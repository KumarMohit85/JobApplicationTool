import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '@/types/profile';
import { createDefaultProfile, getProfile, saveProfile } from '@/lib/profile';

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
      const data = await getProfile();
      setProfile(data);
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
