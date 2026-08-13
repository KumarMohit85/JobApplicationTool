import type { AutofillValueMap } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import { autofillRoot } from '../engine';

export function autofillGenericForm(
  values: AutofillValueMap,
  request: AutofillRequest,
  customAnswers: Record<string, string>,
): AutofillResult {
  const form =
    document.querySelector<HTMLElement>('form[action*="apply"]') ??
    document.querySelector<HTMLElement>('form#application-form') ??
    document.querySelector<HTMLElement>('form') ??
    document.body;

  return autofillRoot(form, values, request, customAnswers);
}
