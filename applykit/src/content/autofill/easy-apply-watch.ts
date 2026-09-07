import type { AutofillRequest } from '@/lib/autofill-types';
import { findLinkedInEasyApplyModal } from './linkedin-selectors';

let observer: MutationObserver | null = null;
let timer: number | null = null;
let filling = false;

/**
 * Re-run Easy Apply fill when the modal swaps to the next wizard step.
 * Does not click Next or Submit.
 */
export function watchEasyApplySteps(
  _request: AutofillRequest,
  refill: () => Promise<void>,
): void {
  const modal = findLinkedInEasyApplyModal();
  if (!modal) return;

  observer?.disconnect();
  observer = new MutationObserver(() => {
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void runRefill(refill);
    }, 600);
  });
  observer.observe(modal, { childList: true, subtree: true });
}

function observeModal(): void {
  const modal = findLinkedInEasyApplyModal();
  if (!modal || !observer) return;
  observer.observe(modal, { childList: true, subtree: true });
}

async function runRefill(refill: () => Promise<void>): Promise<void> {
  if (filling) return;
  const modal = findLinkedInEasyApplyModal();
  if (!modal) return;
  filling = true;
  try {
    observer?.disconnect();
    await refill();
  } finally {
    filling = false;
    observeModal();
  }
}
