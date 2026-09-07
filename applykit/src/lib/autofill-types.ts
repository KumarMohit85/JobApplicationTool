import type { ScannedField } from '@/types/answers';

export type AutofillMode = 'easy_apply' | 'form';

export type ResumeFilePayload = {
  fileName: string;
  base64: string;
};

export type AutofillRequest = {
  mode: AutofillMode;
  forceFill?: boolean;
  coverLetter?: string;
  resumeFile?: ResumeFilePayload;
  /** When true (default), leftover fields are sent to Gemini if AI is enabled. */
  useAi?: boolean;
};

export type AutofillResult = {
  filledCount: number;
  skippedCount: number;
  hints: string[];
  errors: string[];
  unmappedFields: ScannedField[];
  aiFilledCount?: number;
};

export function emptyAutofillResult(): AutofillResult {
  return { filledCount: 0, skippedCount: 0, hints: [], errors: [], unmappedFields: [] };
}

export const LAST_AUTOFILL_STORAGE_KEY = 'applykit_last_autofill';

export type LastAutofillPayload = {
  result: AutofillResult;
  url?: string;
  at: number;
};

export async function persistLastAutofill(result: AutofillResult, url?: string): Promise<void> {
  try {
    await chrome.storage.session.set({
      [LAST_AUTOFILL_STORAGE_KEY]: { result, url, at: Date.now() } satisfies LastAutofillPayload,
    });
  } catch {
    // Session storage may be unavailable in tests
  }
}
