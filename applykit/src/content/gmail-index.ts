import type { ExtensionMessage, ExtensionResponse } from '@/lib/job-context';
import type { GmailFillMessage, GmailFillResponse, PendingCompose } from '@/types/mail';
import { PENDING_COMPOSE_STORAGE_KEY } from '@/types/mail';
import { fillGmailCompose } from './gmail-fill';

type GmailExtensionMessage = ExtensionMessage | GmailFillMessage;
type GmailExtensionResponse = ExtensionResponse | GmailFillResponse;

async function applyPendingCompose(): Promise<void> {
  const result = await chrome.storage.session.get(PENDING_COMPOSE_STORAGE_KEY);
  const pending = result[PENDING_COMPOSE_STORAGE_KEY] as PendingCompose | undefined;
  if (!pending) return;

  const attemptFill = () => {
    const fillResult = fillGmailCompose(pending);
    if (fillResult.success) {
      void chrome.storage.session.remove(PENDING_COMPOSE_STORAGE_KEY);
    }
  };

  attemptFill();
  window.setTimeout(attemptFill, 1200);
  window.setTimeout(attemptFill, 2500);
}

void applyPendingCompose();

chrome.runtime.onMessage.addListener(
  (message: GmailExtensionMessage, _sender, sendResponse: (response: GmailExtensionResponse) => void) => {
    if (message?.type === 'FILL_GMAIL_COMPOSE') {
      const result = fillGmailCompose(message.compose);
      sendResponse({ type: 'GMAIL_FILL_RESULT', ...result });
      return true;
    }
    return false;
  },
);
