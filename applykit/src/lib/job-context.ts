import { JOB_CONTEXT_STORAGE_KEY, type JobContext, type JobSource } from '@/types/job';

export type ExtensionMessage =
  | { type: 'PING' }
  | { type: 'GET_JOB_CONTEXT' }
  | { type: 'GET_SELECTED_TEXT' };

export type ExtensionResponse =
  | { ok: true; version: string }
  | { type: 'JOB_CONTEXT'; context: JobContext | null; error?: string }
  | { type: 'SELECTED_TEXT'; text: string };

export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  );
}

export function createJobContext(partial: {
  title?: string;
  company?: string;
  description?: string;
  url: string;
  source: JobSource;
}): JobContext | null {
  const title = partial.title?.trim() ?? '';
  const company = partial.company?.trim() ?? '';
  const description = partial.description?.trim() ?? '';

  if (!title && !company && !description) {
    return null;
  }

  return {
    title,
    company,
    description,
    url: partial.url,
    source: partial.source,
    extractedAt: new Date().toISOString(),
  };
}

export function mergeDescription(context: JobContext, extraText: string): JobContext {
  const addition = extraText.trim();
  if (!addition) return context;
  const description = context.description ? `${context.description}\n\n${addition}` : addition;
  return {
    ...context,
    description,
    extractedAt: new Date().toISOString(),
  };
}

export async function saveLastJobContext(context: JobContext): Promise<void> {
  await chrome.storage.session.set({ [JOB_CONTEXT_STORAGE_KEY]: context });
}

export async function loadLastJobContext(): Promise<JobContext | null> {
  const result = await chrome.storage.session.get(JOB_CONTEXT_STORAGE_KEY);
  const stored = result[JOB_CONTEXT_STORAGE_KEY];
  if (!stored || typeof stored !== 'object') return null;
  return stored as JobContext;
}

export { JOB_CONTEXT_STORAGE_KEY };
