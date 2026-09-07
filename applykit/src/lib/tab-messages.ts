import type { ExtensionMessage, ExtensionResponse, PageSelectionPayload } from '@/lib/job-context';
import {
  isRestrictedUrl,
  PAGE_SELECTION_CONSUMED_AT_KEY,
  PAGE_SELECTION_STORAGE_KEY,
  saveLastJobContext,
} from '@/lib/job-context';
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

/**
 * Try to inject the content script into a tab.
 * This is needed when the extension was reloaded but tabs were already open
 * (Chrome doesn't re-inject content scripts into existing tabs).
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    // Try a quick ping first to see if content script is already there
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' } as ExtensionMessage);
    if (response && typeof response === 'object' && 'ok' in response) {
      return true;
    }
  } catch {
    // Content script not present — inject it
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/index.ts'],
    });
    // Wait a moment for the script to initialize
    await new Promise((resolve) => setTimeout(resolve, 200));
    return true;
  } catch (err) {
    console.warn('Failed to inject content script:', err);
    return false;
  }
}

/**
 * Send a message to the active tab's content script, auto-injecting if needed.
 */
async function sendToTab<T extends ExtensionResponse>(
  tabId: number,
  message: ExtensionMessage,
): Promise<T | undefined> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T | undefined;
  } catch {
    // First attempt failed — try injecting content script and retry
    const injected = await ensureContentScript(tabId);
    if (!injected) return undefined;

    try {
      return (await chrome.tabs.sendMessage(tabId, message)) as T | undefined;
    } catch {
      return undefined;
    }
  }
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

  const response = await sendToTab<ExtensionResponse>(tab.id, {
    type: 'GET_JOB_CONTEXT',
  } satisfies ExtensionMessage);

  if (!isJobContextResponse(response)) {
    return {
      context: null,
      error:
        'Content script could not load on this page. Try refreshing the LinkedIn tab, then click Scan page again.',
    };
  }
  if (response.error) {
    return { context: null, error: response.error };
  }
  if (response.context) {
    await saveLastJobContext(response.context);
  }
  return { context: response.context };
}

function selectionMatchesTab(payload: PageSelectionPayload, tabUrl: string | undefined): boolean {
  if (!payload.text.trim()) return false;
  if (!tabUrl || !payload.url) return true;
  try {
    return new URL(payload.url).hostname === new URL(tabUrl).hostname;
  } catch {
    return payload.url === tabUrl;
  }
}

export type FetchedSelection = {
  text: string;
  at: number;
};

export async function fetchSelectedTextFromActiveTab(): Promise<FetchedSelection> {
  const tab = await getActiveTab();
  if (!tab?.id || isRestrictedUrl(tab.url)) return { text: '', at: 0 };

  const consumedResult = await chrome.storage.session.get(PAGE_SELECTION_CONSUMED_AT_KEY);
  const consumedAt = (consumedResult[PAGE_SELECTION_CONSUMED_AT_KEY] as number | undefined) ?? 0;

  const response = await sendToTab<ExtensionResponse>(tab.id, {
    type: 'GET_SELECTED_TEXT',
  } satisfies ExtensionMessage);

  let text = '';
  let at = 0;
  if (isSelectedTextResponse(response) && response.text.trim()) {
    text = response.text.trim();
    at = typeof response.at === 'number' ? response.at : 0;
  }

  if (!text) {
    const stored = await chrome.storage.session.get(PAGE_SELECTION_STORAGE_KEY);
    const payload = stored[PAGE_SELECTION_STORAGE_KEY] as PageSelectionPayload | undefined;
    if (payload && selectionMatchesTab(payload, tab.url)) {
      text = payload.text.trim();
      at = payload.at;
    }
  }

  if (!text) return { text: '', at: 0 };
  if (at > 0 && at <= consumedAt) return { text: '', at: 0 };
  return { text, at };
}

export async function consumePageSelection(at: number): Promise<void> {
  await chrome.storage.session.set({ [PAGE_SELECTION_CONSUMED_AT_KEY]: at || Date.now() });
  await chrome.storage.session.remove(PAGE_SELECTION_STORAGE_KEY);
  const tab = await getActiveTab();
  if (tab?.id) {
    void sendToTab(tab.id, { type: 'CLEAR_PAGE_SELECTION' } satisfies ExtensionMessage);
  }
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

  const response = await sendToTab<ExtensionResponse>(tab.id, {
    type: 'INSERT_TEXT',
    text,
  } satisfies ExtensionMessage);

  if (isInsertTextResult(response)) {
    return { success: response.success, error: response.error };
  }
  return { success: false, error: 'Content script did not respond. Refresh the page and try again.' };
}

function isLinkedInPostCaptureResponse(
  response: ExtensionResponse | undefined,
): response is Extract<ExtensionResponse, { type: 'LINKEDIN_POST_CAPTURE' }> {
  return Boolean(response && 'type' in response && response.type === 'LINKEDIN_POST_CAPTURE');
}

export async function captureLinkedInPostFromActiveTab(): Promise<{
  capture: import('@/lib/job-context').LinkedInPostCapturePayload | null;
  error?: string;
}> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return { capture: null, error: 'No active tab found.' };
  }
  if (!tab.url?.includes('linkedin.com')) {
    return { capture: null, error: 'Open a LinkedIn feed post first.' };
  }

  const response = await sendToTab<ExtensionResponse>(tab.id, {
    type: 'CAPTURE_LINKEDIN_POST',
  } satisfies ExtensionMessage);

  if (!isLinkedInPostCaptureResponse(response)) {
    return { capture: null, error: 'Content script did not respond. Refresh LinkedIn and try again.' };
  }
  if (response.error) {
    return { capture: null, error: response.error };
  }
  if (!response.capture) {
    return { capture: null, error: 'No hiring post detected. Scroll to a post with an email or role.' };
  }
  return { capture: response.capture };
}
