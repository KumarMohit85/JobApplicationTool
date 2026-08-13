import type { AutofillValueMap } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import { autofillRoot } from '../engine';

const FORM_ROOT_SELECTORS = [
  '.application-form',
  'form.postings-form',
  'form[action*="lever"]',
  'form',
];

export function autofillLeverForm(
  values: AutofillValueMap,
  request: AutofillRequest,
  customAnswers: Record<string, string>,
): AutofillResult {
  let root: ParentNode = document.body;
  for (const selector of FORM_ROOT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) {
      root = el;
      break;
    }
  }
  return autofillRoot(root, values, request, customAnswers);
}
