import type { AutofillRequest, AutofillResult, ResumeFilePayload } from '@/lib/autofill-types';
import type { ExtensionMessage, ExtensionResponse } from '@/lib/job-context';
import { isRestrictedUrl } from '@/lib/job-context';
import { getResumePdfBlob } from '@/lib/resumes';
import type { ResumeVariant } from '@/types/resume';

function isAutofillResult(
  response: ExtensionResponse | undefined,
): response is Extract<ExtensionResponse, { type: 'AUTOFILL_RESULT' }> {
  return Boolean(response && 'type' in response && response.type === 'AUTOFILL_RESULT');
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export async function buildResumeFilePayload(
  resume: ResumeVariant | null | undefined,
): Promise<ResumeFilePayload | undefined> {
  if (!resume) return undefined;
  const blob = await getResumePdfBlob(resume);
  if (!blob) return undefined;
  const base64 = await blobToBase64(blob);
  return {
    fileName: resume.fileName || `${resume.name.replace(/\s+/g, '_')}.pdf`,
    base64,
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function runAutofillOnActiveTab(
  request: AutofillRequest,
): Promise<{ result: AutofillResult; error?: string }> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return {
      result: { filledCount: 0, skippedCount: 0, hints: [], errors: [] },
      error: 'No active tab found.',
    };
  }
  if (isRestrictedUrl(tab.url)) {
    return {
      result: { filledCount: 0, skippedCount: 0, hints: [], errors: [] },
      error: 'Cannot autofill on this page (browser internal URL).',
    };
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'AUTOFILL',
      request,
    } satisfies ExtensionMessage)) as ExtensionResponse | undefined;

    if (!isAutofillResult(response)) {
      return {
        result: { filledCount: 0, skippedCount: 0, hints: [], errors: [] },
        error: 'Content script did not respond. Refresh the page and try again.',
      };
    }
    if (response.error) {
      return { result: response.result, error: response.error };
    }
    return { result: response.result };
  } catch {
    return {
      result: { filledCount: 0, skippedCount: 0, hints: [], errors: [] },
      error: 'Could not reach this page. Refresh the tab or open a job application form.',
    };
  }
}

export function formatAutofillMessage(result: AutofillResult, error?: string): string {
  if (error) return error;
  if (result.errors.length > 0) return result.errors.join(' ');
  if (result.filledCount === 0 && result.skippedCount === 0) {
    return 'No empty fields found to fill on this step.';
  }
  const parts = [`Filled ${result.filledCount} field${result.filledCount === 1 ? '' : 's'}.`];
  if (result.skippedCount > 0) {
    parts.push(`${result.skippedCount} already had values.`);
  }
  if (result.hints.length > 0) {
    parts.push(result.hints.join(' '));
  }
  return parts.join(' ');
}
