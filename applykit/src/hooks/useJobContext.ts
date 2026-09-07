import { useCallback, useEffect, useState } from 'react';
import type { JobContext } from '@/types/job';
import { loadLastJobContext, saveLastJobContext } from '@/lib/job-context';
import {
  consumePageSelection,
  fetchJobContextFromActiveTab,
  fetchSelectedTextFromActiveTab,
  getActiveTabUrl,
} from '@/lib/tab-messages';

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
    const { text: selected, at } = await fetchSelectedTextFromActiveTab();
    if (!selected) {
      setError('No new highlight found. Select text on the page, then click Add selection.');
      return false;
    }

    const tabUrl = (await getActiveTabUrl()) ?? '';
    setContext((prev) => {
      const next: JobContext = {
        title: prev?.title?.trim() ? prev.title : 'Selected Job Post',
        company: prev?.company ?? '',
        description: selected,
        url: prev?.url || tabUrl,
        source: 'manual',
        extractedAt: new Date().toISOString(),
      };
      void saveLastJobContext(next);
      return next;
    });
    await consumePageSelection(at);
    setError(null);
    return true;
  }, []);

  return { context, loading, error, refresh, appendSelection, setContext };
}
