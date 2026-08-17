import { useCallback, useRef, useState } from 'react';
import type { AiGenerateRequest, AiGenerateResponse } from '@/types/ai';

type UseAiGenerateState<T> = {
  result: T | null;
  loading: boolean;
  error: string | null;
  generate: (request: AiGenerateRequest) => Promise<T | null>;
  reset: () => void;
};

function hashRequest(request: AiGenerateRequest): string {
  const key = [
    request.job.url || request.job.title,
    request.profile.updatedAt,
    request.selectedResumeId ?? '',
    request.mode,
  ].join('|');
  return key;
}

/**
 * Hook for sending an AI generation request to the background worker.
 * Results are cached in sessionStorage per (url + profile timestamp + resumeId + mode)
 * to avoid re-calling on every tab switch.
 */
export function useAiGenerate<T>(
  extractor: (response: AiGenerateResponse) => T | undefined,
): UseAiGenerateState<T> {
  const [result, setResult] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, T>>(new Map());

  const generate = useCallback(
    async (request: AiGenerateRequest): Promise<T | null> => {
      const cacheKey = hashRequest(request);
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setResult(cached);
        setError(null);
        return cached;
      }

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'AI_GENERATE',
          request,
        })) as AiGenerateResponse;

        if (!response.ok) {
          setError(response.error ?? 'AI generation failed.');
          return null;
        }

        const extracted = extractor(response);
        if (!extracted) {
          setError('AI returned an unexpected response structure.');
          return null;
        }

        cacheRef.current.set(cacheKey, extracted);
        setResult(extracted);
        return extracted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI request failed.';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [extractor],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, generate, reset };
}
