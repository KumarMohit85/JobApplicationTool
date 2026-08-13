import type { AutofillValueMap } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import { autofillRoot } from '../engine';

const FORM_ROOT_SELECTORS = [
  '#application_form',
  '#application-form',
  'form#application',
  'form[action*="greenhouse"]',
  'form',
];

export function autofillGreenhouseForm(
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
