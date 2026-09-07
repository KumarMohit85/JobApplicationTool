import { mapFieldKey } from './field-mapper';
import { isCertifyQuestion } from '@/lib/answers';

/** Extract clean, human-readable question text from a form control. */
export function extractQuestionLabel(el: HTMLElement): string {
  const id = el.getAttribute('id');
  let labelText = '';

  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) labelText = label.textContent;
  }

  if (!labelText) {
    const wrapped = el.closest('label');
    if (wrapped?.textContent) labelText = wrapped.textContent;
  }

  if (!labelText) {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const parts = labelledBy
        .split(/\s+/)
        .map((idPart) => document.getElementById(idPart)?.textContent ?? '')
        .filter(Boolean);
      if (parts.length > 0) labelText = parts.join(' ');
    }
  }

  if (!labelText) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) labelText = ariaLabel;
  }

  if (!labelText) {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) labelText = placeholder;
  }

  if (!labelText) {
    const parentLabel = el
      .closest('div, fieldset, section, li, td')
      ?.querySelector('label, legend, p, span, h3, h4');
    if (parentLabel?.textContent) labelText = parentLabel.textContent;
  }

  return labelText.replace(/[*#]/g, '').replace(/\s+/g, ' ').trim();
}

/** Check if field should be ignored for learning (passwords, hidden fields, identity). */
function isSensitiveOrIgnored(el: HTMLElement): boolean {
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  if (['password', 'hidden', 'submit', 'button', 'file'].includes(type)) return true;

  const name = (el.getAttribute('name') ?? '').toLowerCase();
  const autocomplete = (el.getAttribute('autocomplete') ?? '').toLowerCase();
  if (name.includes('password') || autocomplete.includes('password') || name.includes('token')) {
    return true;
  }

  const key = mapFieldKey(el);
  if (key && ['firstName', 'lastName', 'fullName', 'email', 'phone'].includes(key)) {
    return true;
  }

  return false;
}

function getElementValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      return el.checked ? el.value || 'Yes' : '';
    }
    return el.value.trim();
  }
  if (el instanceof HTMLSelectElement) {
    const text = el.selectedOptions[0]?.text?.trim();
    return text || el.value.trim();
  }
  if (el instanceof HTMLTextAreaElement) {
    return el.value.trim();
  }
  return '';
}

const pending = new Map<string, number>();

/**
 * Learn answers the user types on application forms (debounced).
 * Identity fields and certify/password controls are ignored.
 */
export function initFormLearner(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target || !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    if (isSensitiveOrIgnored(target)) return;

    const question = extractQuestionLabel(target);
    const value = getElementValue(target);

    if (!question || question.length < 8 || !value) return;
    if (isCertifyQuestion(question)) return;

    const prev = pending.get(question);
    if (prev != null) window.clearTimeout(prev);
    pending.set(
      question,
      window.setTimeout(() => {
        pending.delete(question);
        try {
          void chrome.runtime.sendMessage({
            type: 'SAVE_CUSTOM_ANSWER',
            question,
            answer: value,
            siteHint: window.location.hostname,
          });
        } catch {
          // Extension context invalidated
        }
      }, 700),
    );
  };

  document.addEventListener('change', handleInputChange, true);
  document.addEventListener('blur', handleInputChange, true);
}
