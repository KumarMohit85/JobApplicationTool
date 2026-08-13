import type { ExtensionMessage, ExtensionResponse } from '@/lib/job-context';
import { isRestrictedUrl, saveLastJobContext } from '@/lib/job-context';
import type { JobContext } from '@/types/job';

function isJobContextResponse(
  response: ExtensionResponse | undefined,
): response is Extract<ExtensionResponse, { type: 'JOB_CONTEXT' }> {
  return Boolean(response && 'type' in response && response.type === 'JOB_CONTEXT');
}

function isSelectedTextResponse(
  response: ExtensionResponse | undefined,
): response is Extract<ExtensionResponse, { type: 'SELECTED_TEXT' }> {
  return Boolean(response && 'type' in response && response.type === 'SELECTED_TEXT');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function fetchJobContextFromActiveTab(): Promise<{
  context: JobContext | null;
  error?: string;
}> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return { context: null, error: 'No active tab found.' };
  }
  if (isRestrictedUrl(tab.url)) {
    return { context: null, error: 'Cannot read job details on this page (browser internal URL).' };
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_JOB_CONTEXT',
    } satisfies ExtensionMessage)) as ExtensionResponse | undefined;

    if (!isJobContextResponse(response)) {
      return { context: null, error: 'Content script did not respond. Try refreshing the page.' };
    }
    if (response.error) {
      return { context: null, error: response.error };
    }
    if (response.context) {
      await saveLastJobContext(response.context);
    }
    return { context: response.context };
  } catch {
    return {
      context: null,
      error: 'Could not reach this page. Refresh the tab or open a supported job posting.',
    };
  }
}

export async function fetchSelectedTextFromActiveTab(): Promise<string> {
  const tab = await getActiveTab();
  if (!tab?.id || isRestrictedUrl(tab.url)) return '';

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_SELECTED_TEXT',
    } satisfies ExtensionMessage)) as ExtensionResponse | undefined;

    if (isSelectedTextResponse(response)) {
      return response.text;
    }
  } catch {
    // ignore
  }
  return '';
}

export async function getActiveTabUrl(): Promise<string | undefined> {
  const tab = await getActiveTab();
  return tab?.url;
}

function isInsertTextResult(
  response: ExtensionResponse | undefined,
): response is Extract<ExtensionResponse, { type: 'INSERT_TEXT_RESULT' }> {
  return Boolean(response && 'type' in response && response.type === 'INSERT_TEXT_RESULT');
}

export async function insertTextToActiveTab(text: string): Promise<{ success: boolean; error?: string }> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return { success: false, error: 'No active tab found.' };
  }
  if (isRestrictedUrl(tab.url)) {
    return { success: false, error: 'Cannot insert text on this page.' };
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'INSERT_TEXT',
      text,
    } satisfies ExtensionMessage)) as ExtensionResponse | undefined;

    if (isInsertTextResult(response)) {
      return { success: response.success, error: response.error };
    }
    return { success: false, error: 'Content script did not respond. Refresh the page and try again.' };
  } catch {
    return { success: false, error: 'Could not insert text. Click the target field on the page first.' };
  }
}
