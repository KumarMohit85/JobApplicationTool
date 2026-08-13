import type { AutofillValueMap } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import { autofillRoot } from '../engine';
import { findLinkedInEasyApplyModal } from '../linkedin-selectors';

export function autofillLinkedInEasyApply(
  values: AutofillValueMap,
  request: AutofillRequest,
  customAnswers: Record<string, string>,
): AutofillResult {
  const modal = findLinkedInEasyApplyModal();
  if (!modal) {
    return {
      filledCount: 0,
      skippedCount: 0,
      hints: [],
      errors: ['Open the LinkedIn Easy Apply modal first, then click Fill Easy Apply.'],
    };
  }

  const result = autofillRoot(modal, values, request, customAnswers);

  if (request.resumeFile && !result.hints.some((h) => h.startsWith('Attached resume'))) {
    const fileInputs = modal.querySelectorAll<HTMLInputElement>('input[type="file"]');
    if (fileInputs.length > 0 && !result.hints.some((h) => h.startsWith('Choose resume'))) {
      result.hints.push(`Choose resume: ${request.resumeFile.fileName}`);
    }
  }

  return result;
}
