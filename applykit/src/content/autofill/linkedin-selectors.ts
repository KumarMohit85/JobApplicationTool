/** LinkedIn Easy Apply modal selectors — update here when LinkedIn changes DOM. */

export const LINKEDIN_EASY_APPLY_MODAL_SELECTORS = [
  '[data-test-modal-id="easy-apply-modal"]',
  '.jobs-easy-apply-modal',
  '[data-test-modal="easy-apply"]',
  'div[role="dialog"]',
];

export function findLinkedInEasyApplyModal(): HTMLElement | null {
  for (const selector of LINKEDIN_EASY_APPLY_MODAL_SELECTORS) {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const hasInputs = el.querySelector('input, textarea, select');
      if (hasInputs) return el;
    }
  }
  return null;
}
