import type { AutofillValueMap } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import { collectFieldHints, lookupCustomAnswer, mapFieldKey } from './field-mapper';

type FillStats = {
  filledCount: number;
  skippedCount: number;
  hints: string[];
  errors: string[];
};

function dispatchInputEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function isVisible(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function shouldFill(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, forceFill: boolean): boolean {
  if (el.disabled) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.readOnly) return false;
  }
  if (forceFill) return true;
  return !el.value.trim();
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
}

function matchOptionText(optionText: string, value: string): boolean {
  const a = optionText.trim().toLowerCase();
  const b = value.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (b === 'yes' && (a === 'yes' || a.startsWith('yes'))) return true;
  if (b === 'no' && (a === 'no' || a.startsWith('no'))) return true;
  return a.includes(b) || b.includes(a);
}

function fillSelect(select: HTMLSelectElement, value: string, forceFill: boolean): boolean {
  if (!value || !shouldFill(select, forceFill)) return false;

  for (const option of select.options) {
    if (matchOptionText(option.text, value) || matchOptionText(option.value, value)) {
      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

function fillTextControl(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  forceFill: boolean,
): boolean {
  if (!value || !shouldFill(el, forceFill)) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (!['text', 'search', 'email', 'tel', 'url', 'number'].includes(type)) {
      return false;
    }
  }
  el.focus();
  setNativeValue(el, value);
  dispatchInputEvents(el);
  return true;
}

function fillRadioGroup(root: ParentNode, value: string, forceFill: boolean): boolean {
  const radios = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter(isVisible);
  if (radios.length === 0) return false;

  const name = radios[0]?.name;
  const group = name ? radios.filter((r) => r.name === name) : radios;
  const checked = group.some((r) => r.checked);
  if (checked && !forceFill) return false;

  const target = group.find((r) => {
    const label = r.labels?.[0]?.textContent ?? r.value;
    return matchOptionText(label, value);
  });
  if (!target) return false;

  target.click();
  target.checked = true;
  dispatchInputEvents(target);
  return true;
}

function fillFileInput(input: HTMLInputElement, fileName: string, base64: string): boolean {
  if (input.type !== 'file' || input.files?.length) return false;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const file = new File([bytes], fileName, { type: 'application/pdf' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

function resolveValue(
  key: string | null,
  hints: string,
  values: AutofillValueMap,
  customAnswers: Record<string, string>,
): string | undefined {
  if (key && values[key as keyof AutofillValueMap]) {
    return values[key as keyof AutofillValueMap];
  }
  const custom = lookupCustomAnswer(hints, customAnswers);
  return custom ?? undefined;
}

export function autofillRoot(
  root: ParentNode,
  values: AutofillValueMap,
  request: AutofillRequest,
  customAnswers: Record<string, string>,
): AutofillResult {
  const stats: FillStats = {
    filledCount: 0,
    skippedCount: 0,
    hints: [],
    errors: [],
  };
  const forceFill = request.forceFill ?? false;

  const controls = [
    ...root.querySelectorAll<HTMLInputElement>('input'),
    ...root.querySelectorAll<HTMLTextAreaElement>('textarea'),
    ...root.querySelectorAll<HTMLSelectElement>('select'),
  ].filter(isVisible);

  for (const el of controls) {
    const hints = collectFieldHints(el);
    const key = mapFieldKey(el);
    const value = resolveValue(key, hints, values, customAnswers);

    if (el instanceof HTMLSelectElement) {
      if (value && fillSelect(el, value, forceFill)) {
        stats.filledCount += 1;
      } else if (value) {
        stats.skippedCount += 1;
      }
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (value && fillRadioGroup(el.parentElement ?? root, value, forceFill)) {
        stats.filledCount += 1;
      }
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'file') {
      if (request.resumeFile && fillFileInput(el, request.resumeFile.fileName, request.resumeFile.base64)) {
        stats.filledCount += 1;
        stats.hints.push(`Attached resume: ${request.resumeFile.fileName}`);
      } else if (request.resumeFile) {
        stats.hints.push(`Choose resume file: ${request.resumeFile.fileName}`);
      }
      continue;
    }

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      if (value && fillTextControl(el, value, forceFill)) {
        stats.filledCount += 1;
      } else if (value && el.value.trim()) {
        stats.skippedCount += 1;
      }
      continue;
    }
  }

  return stats;
}
