import { useCallback, useEffect, useState } from 'react';
import type { JobContext } from '@/types/job';
import { loadLastJobContext, mergeDescription, saveLastJobContext } from '@/lib/job-context';
import { fetchJobContextFromActiveTab, fetchSelectedTextFromActiveTab } from '@/lib/tab-messages';

type UseJobContextState = {
  context: JobContext | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  appendSelection: () => Promise<boolean>;
  setContext: React.Dispatch<React.SetStateAction<JobContext | null>>;
};

export function useJobContext(autoLoad = true): UseJobContextState {
  const [context, setContext] = useState<JobContext | null>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJobContextFromActiveTab();
      if (result.error && !result.context) {
        setError(result.error);
        setContext(null);
      } else {
        setContext(result.context);
        if (!result.context) {
          setError('No job details detected on this page. Try selecting text and use "Add selection".');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read page.');
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    void (async () => {
      const cached = await loadLastJobContext();
      if (cached) setContext(cached);
      await refresh();
    })();
  }, [autoLoad, refresh]);

  const appendSelection = useCallback(async (): Promise<boolean> => {
    const selected = await fetchSelectedTextFromActiveTab();
    if (!selected) {
      setError('No text selected on the page. Highlight a job description first.');
      return false;
    }

    setContext((prev) => {
      const base =
        prev ??
        ({
          title: '',
          company: '',
          description: '',
          url: '',
          source: 'manual',
          extractedAt: new Date().toISOString(),
        } satisfies JobContext);
      const merged = mergeDescription(base, selected);
      void saveLastJobContext(merged);
      return merged;
    });
    setError(null);
    return true;
  }, []);

  return { context, loading, error, refresh, appendSelection, setContext };
}
