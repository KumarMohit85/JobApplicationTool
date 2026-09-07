import type { AutofillValueMap } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import type { AnswerEntry } from '@/types/answers';
import type { ScannedField } from '@/types/answers';
import { lookupAnswerValue, isCertifyQuestion, normalizeQuestion } from '@/lib/answers';
import { collectFieldHints, lookupCustomAnswer, mapFieldKey } from './field-mapper';
import { extractQuestionLabel } from './form-learner';

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
  if (b.includes('decline') && a.includes('decline')) return true;
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
    if (!['text', 'search', 'email', 'tel', 'url', 'number', 'date'].includes(type)) {
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

function fillCheckbox(input: HTMLInputElement, value: string, forceFill: boolean): boolean {
  if (input.disabled) return false;
  const wantChecked = /^(yes|true|on|1)$/i.test(value.trim());
  if (input.checked === wantChecked && !forceFill) return false;
  if (input.checked && !forceFill) return false;
  input.checked = wantChecked;
  if (wantChecked) input.click();
  dispatchInputEvents(input);
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
  question: string,
  values: AutofillValueMap,
  customAnswers: Record<string, string>,
  answerBank: AnswerEntry[],
): string | undefined {
  if (isCertifyQuestion(question) || isCertifyQuestion(hints)) {
    return undefined;
  }
  if (key && values[key as keyof AutofillValueMap]) {
    return values[key as keyof AutofillValueMap];
  }
  const fromBank = lookupAnswerValue(answerBank, question || hints);
  if (fromBank) return fromBank;
  const custom = lookupCustomAnswer(hints, customAnswers) ?? lookupCustomAnswer(question, customAnswers);
  return custom ?? undefined;
}

function pushUnmapped(stats: AutofillResult, field: ScannedField): void {
  const key = normalizeQuestion(field.question);
  if (!key) return;
  if (stats.unmappedFields.some((f) => normalizeQuestion(f.question) === key)) return;
  stats.unmappedFields.push(field);
}

function fieldTypeOf(el: HTMLElement): ScannedField['fieldType'] {
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase();
    if (t === 'radio') return 'radio';
    if (t === 'checkbox') return 'checkbox';
    if (t === 'file') return 'file';
    if (t === 'date') return 'date';
    if (t === 'number') return 'number';
  }
  return 'text';
}

function selectOptions(el: HTMLElement): string[] | undefined {
  if (el instanceof HTMLSelectElement) {
    return [...el.options].map((o) => o.text.trim()).filter(Boolean);
  }
  if (el instanceof HTMLInputElement && el.type === 'radio') {
    const name = el.name;
    const group = name
      ? [...document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`)]
      : [el];
    return group.map((r) => (r.labels?.[0]?.textContent ?? r.value).trim()).filter(Boolean);
  }
  return undefined;
}

export function autofillRoot(
  root: ParentNode,
  values: AutofillValueMap,
  request: AutofillRequest,
  customAnswers: Record<string, string>,
  answerBank: AnswerEntry[] = [],
): AutofillResult {
  const stats: AutofillResult = {
    filledCount: 0,
    skippedCount: 0,
    hints: [],
    errors: [],
    unmappedFields: [],
  };
  const forceFill = request.forceFill ?? false;
  const seenRadioNames = new Set<string>();

  const controls = [
    ...root.querySelectorAll<HTMLInputElement>('input'),
    ...root.querySelectorAll<HTMLTextAreaElement>('textarea'),
    ...root.querySelectorAll<HTMLSelectElement>('select'),
  ].filter(isVisible);

  for (const el of controls) {
    if (el instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'password', 'image'].includes(el.type)) {
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      const name = el.name || extractQuestionLabel(el);
      if (seenRadioNames.has(name)) continue;
      seenRadioNames.add(name);
    }

    const hints = collectFieldHints(el);
    const question = extractQuestionLabel(el) || hints;
    const key = mapFieldKey(el);
    const value = resolveValue(key, hints, question, values, customAnswers, answerBank);

    if (el instanceof HTMLSelectElement) {
      if (value && fillSelect(el, value, forceFill)) {
        stats.filledCount += 1;
      } else if (value && el.value.trim()) {
        stats.skippedCount += 1;
      } else if (!value && !el.value.trim() && question.length >= 6) {
        pushUnmapped(stats, {
          question,
          fieldType: 'select',
          options: selectOptions(el),
          mappedKey: key ?? undefined,
        });
      }
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (value && fillRadioGroup(el.parentElement ?? root, value, forceFill)) {
        stats.filledCount += 1;
      } else if (!value) {
        const groupChecked = el.name
          ? [...root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`)].some(
              (r) => r.checked,
            )
          : el.checked;
        if (!groupChecked && question.length >= 6) {
          pushUnmapped(stats, {
            question,
            fieldType: 'radio',
            options: selectOptions(el),
            mappedKey: key ?? undefined,
          });
        }
      }
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (isCertifyQuestion(question) || isCertifyQuestion(hints)) {
        if (!el.checked && question.length >= 6) {
          pushUnmapped(stats, {
            question,
            fieldType: 'checkbox',
            mappedKey: key ?? undefined,
          });
        }
        continue;
      }
      if (value && fillCheckbox(el, value, forceFill)) {
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
      } else if (!value && !el.value.trim() && question.length >= 6) {
        pushUnmapped(stats, {
          question,
          fieldType: fieldTypeOf(el),
          mappedKey: key ?? undefined,
        });
      }
    }
  }

  return stats;
}

/** Fill a single field whose label matches the question (after the user saved an answer). */
export function fillFieldByQuestion(
  root: ParentNode,
  question: string,
  value: string,
): boolean {
  const controls = [
    ...root.querySelectorAll<HTMLInputElement>('input'),
    ...root.querySelectorAll<HTMLTextAreaElement>('textarea'),
    ...root.querySelectorAll<HTMLSelectElement>('select'),
  ].filter(isVisible);

  for (const el of controls) {
    const label = extractQuestionLabel(el);
    const hints = collectFieldHints(el);
    if (!label && !hints) continue;
    const hay = `${label} ${hints}`;
    if (!hay.toLowerCase().includes(question.toLowerCase()) && !question.toLowerCase().includes(label.toLowerCase())) {
      continue;
    }
    if (el instanceof HTMLSelectElement) return fillSelect(el, value, true);
    if (el instanceof HTMLInputElement && el.type === 'radio') {
      return fillRadioGroup(el.parentElement ?? root, value, true);
    }
    if (el instanceof HTMLInputElement && el.type === 'checkbox') return fillCheckbox(el, value, true);
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return fillTextControl(el, value, true);
    }
  }
  return false;
}
