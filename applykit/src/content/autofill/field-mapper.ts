import { FIELD_PATTERNS } from '@/lib/autofill-map';
import type { FieldKey } from '@/lib/autofill-values';

function normalizeHint(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function labelForControl(el: HTMLElement): string {
  const id = el.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) return label.textContent;
  }

  const wrapped = el.closest('label');
  if (wrapped?.textContent) return wrapped.textContent;

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((idPart) => document.getElementById(idPart)?.textContent ?? '')
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder;

  const parentLabel = el.closest('div, fieldset, section, li')?.querySelector('label, legend, span');
  if (parentLabel?.textContent) return parentLabel.textContent;

  return '';
}

export function collectFieldHints(el: HTMLElement): string {
  const parts = [
    labelForControl(el),
    el.getAttribute('name') ?? '',
    el.getAttribute('id') ?? '',
    el.getAttribute('placeholder') ?? '',
    el.getAttribute('aria-label') ?? '',
    el.getAttribute('autocomplete') ?? '',
    el.getAttribute('data-test') ?? '',
    el.getAttribute('data-qa') ?? '',
  ];
  return normalizeHint(parts.join(' '));
}

export function mapFieldKey(el: HTMLElement): FieldKey | null {
  const autocomplete = (el.getAttribute('autocomplete') ?? '').toLowerCase();
  const hints = collectFieldHints(el);

  for (const pattern of FIELD_PATTERNS) {
    if (pattern.autocomplete?.some((a) => autocomplete === a.toLowerCase())) {
      if (pattern.key === 'fullName' && (hints.includes('first') || hints.includes('last'))) {
        continue;
      }
      return pattern.key;
    }
  }

  for (const pattern of FIELD_PATTERNS) {
    if (pattern.patterns.some((re) => re.test(hints))) {
      return pattern.key;
    }
  }

  return null;
}

export function lookupCustomAnswer(hints: string, customAnswers: Record<string, string>): string | null {
  const normalizedHints = normalizeHint(hints);
  for (const [question, answer] of Object.entries(customAnswers)) {
    const q = normalizeHint(question);
    if (!q || !answer.trim()) continue;
    if (normalizedHints.includes(q) || q.includes(normalizedHints)) {
      return answer;
    }
  }
  return null;
}
