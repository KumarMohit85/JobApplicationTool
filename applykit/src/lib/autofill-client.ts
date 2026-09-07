import type { AutofillRequest, AutofillResult, ResumeFilePayload } from '@/lib/autofill-types';
import { emptyAutofillResult } from '@/lib/autofill-types';
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
  const queries: chrome.tabs.QueryInfo[] = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
  ];
  for (const query of queries) {
    const [tab] = await chrome.tabs.query(query);
    if (tab?.id && !isRestrictedUrl(tab.url)) return tab;
  }
  const tabs = await chrome.tabs.query({ active: true });
  return tabs.find((tab) => tab.id && !isRestrictedUrl(tab.url));
}

export async function runAutofillOnActiveTab(
  request: AutofillRequest,
): Promise<{ result: AutofillResult; error?: string }> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return {
      result: emptyAutofillResult(),
      error: 'No active tab found.',
    };
  }
  if (isRestrictedUrl(tab.url)) {
    return {
      result: emptyAutofillResult(),
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
        result: emptyAutofillResult(),
        error: 'Content script did not respond. Refresh the page and try again.',
      };
    }
    if (response.error) {
      return { result: response.result, error: response.error };
    }
    return { result: response.result };
  } catch {
    return {
      result: emptyAutofillResult(),
      error: 'Could not reach this page. Refresh the tab or open a job application form.',
    };
  }
}

export function formatAutofillMessage(result: AutofillResult, error?: string): string {
  if (error) return error;
  if (result.errors.length > 0) return result.errors.join(' ');
  if (result.filledCount === 0 && result.skippedCount === 0 && !(result.unmappedFields?.length)) {
    return 'No empty fields found to fill on this step.';
  }
  const parts = [`Filled ${result.filledCount} field${result.filledCount === 1 ? '' : 's'}.`];
  if (result.skippedCount > 0) {
    parts.push(`${result.skippedCount} already had values.`);
  }
  if (result.hints.length > 0) {
    parts.push(result.hints.join(' '));
  }
  if (result.aiFilledCount) {
    parts.push(`${result.aiFilledCount} from AI.`);
  }
  if (result.unmappedFields?.length) {
    parts.push(`${result.unmappedFields.length} need your input.`);
  }
  return parts.join(' ');
}

export async function fillFieldOnActiveTab(
  question: string,
  value: string,
): Promise<boolean> {
  const tab = await getActiveTab();
  if (!tab?.id) return false;
  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_FIELD',
      question,
      value,
    } satisfies ExtensionMessage)) as ExtensionResponse | undefined;
    return Boolean(response && 'type' in response && response.type === 'FILL_FIELD_RESULT' && response.success);
  } catch {
    return false;
  }
}
