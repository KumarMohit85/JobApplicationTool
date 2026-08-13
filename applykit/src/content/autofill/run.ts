import { getProfile } from '@/lib/profile';
import { buildAutofillValues } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import { detectAutofillSite } from './detect-site';
import { autofillGenericForm } from './adapters/generic';
import { autofillGreenhouseForm } from './adapters/greenhouse';
import { autofillLeverForm } from './adapters/lever';
import { autofillLinkedInEasyApply } from './adapters/linkedin-easy-apply';

export async function runAutofillOnPage(request: AutofillRequest): Promise<AutofillResult> {
  const profile = await getProfile();
  const values = buildAutofillValues(profile, { coverLetter: request.coverLetter });
  const customAnswers = profile.easyApplyDefaults.customAnswers;

  if (request.mode === 'easy_apply') {
    return autofillLinkedInEasyApply(values, request, customAnswers);
  }

  const site = detectAutofillSite(window.location.hostname);
  switch (site) {
    case 'greenhouse':
      return autofillGreenhouseForm(values, request, customAnswers);
    case 'lever':
      return autofillLeverForm(values, request, customAnswers);
    default:
      return autofillGenericForm(values, request, customAnswers);
  }
}
