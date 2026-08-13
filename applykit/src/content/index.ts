import type { ExtensionMessage, ExtensionResponse } from '@/lib/job-context';
import { extractJobContextFromPage, getSelectedTextFromPage } from './extract';

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    if (message?.type === 'GET_JOB_CONTEXT') {
      try {
        const context = extractJobContextFromPage();
        sendResponse({ type: 'JOB_CONTEXT', context });
      } catch {
        sendResponse({ type: 'JOB_CONTEXT', context: null, error: 'Failed to extract job context.' });
      }
      return true;
    }

    if (message?.type === 'GET_SELECTED_TEXT') {
      sendResponse({ type: 'SELECTED_TEXT', text: getSelectedTextFromPage() });
      return true;
    }

    return false;
  },
);
