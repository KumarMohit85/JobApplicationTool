import { useCallback, useEffect, useState } from 'react';
import {
  AI_SETTINGS_STORAGE_KEY,
  createDefaultAiSettings,
  type AiSettings,
} from '@/types/ai-settings';

type UseAiSettingsState = {
  settings: AiSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setSettings: (partial: Partial<AiSettings>) => void;
  save: () => Promise<boolean>;
  reload: () => Promise<void>;
};

export function useAiSettings(): UseAiSettingsState {
  const [settings, setSettingsState] = useState<AiSettings>(createDefaultAiSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await chrome.storage.local.get(AI_SETTINGS_STORAGE_KEY);
      const stored = result[AI_SETTINGS_STORAGE_KEY] as Partial<AiSettings> | undefined;
      setSettingsState({ ...createDefaultAiSettings(), ...(stored ?? {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setSettings = useCallback((partial: Partial<AiSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...partial }));
    setError(null);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await chrome.storage.local.set({ [AI_SETTINGS_STORAGE_KEY]: settings });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI settings.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings]);

  return { settings, loading, saving, error, setSettings, save, reload };
}
