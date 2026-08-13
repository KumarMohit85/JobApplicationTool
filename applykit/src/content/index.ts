import type { ExtensionMessage, ExtensionResponse } from '@/lib/job-context';
import { runAutofillOnPage } from './autofill/run';
import { extractJobContextFromPage, getSelectedTextFromPage } from './extract';
import { insertTextOnPage } from './insert';
import { captureLinkedInPost } from './post-capture';
import { initLinkedInPostOverlay } from './post-overlay';

if (/linkedin\.com/i.test(window.location.hostname)) {
  initLinkedInPostOverlay();
}

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

    if (message?.type === 'INSERT_TEXT') {
      const result = insertTextOnPage(message.text);
      sendResponse({ type: 'INSERT_TEXT_RESULT', ...result });
      return true;
    }

    if (message?.type === 'AUTOFILL') {
      void runAutofillOnPage(message.request)
        .then((result) => {
          sendResponse({ type: 'AUTOFILL_RESULT', result });
        })
        .catch(() => {
          sendResponse({
            type: 'AUTOFILL_RESULT',
            result: { filledCount: 0, skippedCount: 0, hints: [], errors: [] },
            error: 'Autofill failed on this page.',
          });
        });
      return true;
    }

    if (message?.type === 'CAPTURE_LINKEDIN_POST') {
      try {
        const capture = captureLinkedInPost();
        sendResponse({ type: 'LINKEDIN_POST_CAPTURE', capture });
      } catch {
        sendResponse({
          type: 'LINKEDIN_POST_CAPTURE',
          capture: null,
          error: 'Failed to read LinkedIn post.',
        });
      }
      return true;
    }

    return false;
  },
);
