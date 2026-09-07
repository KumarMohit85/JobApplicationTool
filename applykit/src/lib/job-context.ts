import { JOB_CONTEXT_STORAGE_KEY, type JobContext, type JobSource } from '@/types/job';

import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';

export type LinkedInPostCapturePayload = {
  emails: string[];
  phoneNumbers: string[];
  whatsappNumbers: string[];
  company: string;
  role: string;
  description: string;
  sourceUrl: string;
};

export type ExtensionMessage =
  | { type: 'PING' }
  | { type: 'GET_JOB_CONTEXT' }
  | { type: 'GET_SELECTED_TEXT' }
  | { type: 'CLEAR_PAGE_SELECTION' }
  | { type: 'INSERT_TEXT'; text: string }
  | { type: 'AUTOFILL'; request: AutofillRequest }
  | { type: 'FILL_FIELD'; question: string; value: string }
  | { type: 'CAPTURE_LINKEDIN_POST' };

export type ExtensionResponse =
  | { ok: true; version: string }
  | { type: 'JOB_CONTEXT'; context: JobContext | null; error?: string }
  | { type: 'SELECTED_TEXT'; text: string; at?: number }
  | { type: 'INSERT_TEXT_RESULT'; success: boolean; error?: string }
  | { type: 'AUTOFILL_RESULT'; result: AutofillResult; error?: string }
  | { type: 'FILL_FIELD_RESULT'; success: boolean }
  | { type: 'LINKEDIN_POST_CAPTURE'; capture: LinkedInPostCapturePayload | null; error?: string };

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

/** True when this chunk is already the whole JD or a trailing / equal block. */
export function descriptionAlreadyHasChunk(description: string, selected: string): boolean {
  const d = description.trim();
  const s = selected.trim();
  if (!d || !s) return false;
  if (d === s) return true;
  if (d.endsWith(s)) return true;
  return d.split(/\n\n+/).some((block) => block.trim() === s);
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

export const PAGE_SELECTION_STORAGE_KEY = 'applykit_page_selection';
export const PAGE_SELECTION_CONSUMED_AT_KEY = 'applykit_page_selection_consumed_at';

export type PageSelectionPayload = {
  text: string;
  url: string;
  at: number;
};

export { JOB_CONTEXT_STORAGE_KEY };
