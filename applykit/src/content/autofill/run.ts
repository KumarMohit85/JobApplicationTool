import { getProfile, saveProfile } from '@/lib/profile';
import { buildAutofillValues } from '@/lib/autofill-values';
import type { AutofillRequest, AutofillResult } from '@/lib/autofill-types';
import { emptyAutofillResult, persistLastAutofill } from '@/lib/autofill-types';
import type { AnswerEntry, ScannedField } from '@/types/answers';
import { detectAutofillSite } from './detect-site';
import { autofillGenericForm } from './adapters/generic';
import { autofillGreenhouseForm } from './adapters/greenhouse';
import { autofillLeverForm } from './adapters/lever';
import { autofillLinkedInEasyApply } from './adapters/linkedin-easy-apply';
import { fillFieldByQuestion } from './engine';
import { watchEasyApplySteps } from './easy-apply-watch';
import { upsertAnswer } from '@/lib/answers';

function runSiteFill(
  request: AutofillRequest,
  values: ReturnType<typeof buildAutofillValues>,
  customAnswers: Record<string, string>,
  answerBank: AnswerEntry[],
): AutofillResult {
  if (request.mode === 'easy_apply') {
    return autofillLinkedInEasyApply(values, request, customAnswers, answerBank);
  }
  const site = detectAutofillSite(window.location.hostname);
  switch (site) {
    case 'greenhouse':
      return autofillGreenhouseForm(values, request, customAnswers, answerBank);
    case 'lever':
      return autofillLeverForm(values, request, customAnswers, answerBank);
    default:
      return autofillGenericForm(values, request, customAnswers, answerBank);
  }
}

export async function runAutofillOnPage(
  request: AutofillRequest,
  options?: { skipWatch?: boolean },
): Promise<AutofillResult> {
  const profile = await getProfile();
  const values = buildAutofillValues(profile, { coverLetter: request.coverLetter });
  const customAnswers = profile.easyApplyDefaults.customAnswers;
  const answerBank = profile.answerBank ?? [];

  let result = runSiteFill(request, values, customAnswers, answerBank);

  const useAi = request.useAi !== false;
  if (useAi && result.unmappedFields.length > 0) {
    try {
      const ai = (await chrome.runtime.sendMessage({
        type: 'AI_ANSWER_FIELDS',
        fields: result.unmappedFields,
      })) as { ok?: boolean; decisions?: { question: string; action: string; value?: string }[] };

      if (ai?.decisions?.length) {
        let aiFilled = 0;
        const stillUnmapped: ScannedField[] = [];
        let bank = answerBank;
        const root = document;

        for (const field of result.unmappedFields) {
          const decision = ai.decisions.find((d) => d.question === field.question);
          if (decision?.action === 'fill' && decision.value) {
            const ok = fillFieldByQuestion(root, field.question, decision.value);
            if (ok) {
              aiFilled += 1;
              bank = upsertAnswer(bank, field.question, decision.value, {
                source: 'ai_suggested',
                options: field.options,
                siteHint: window.location.hostname,
                incrementUse: true,
              });
              continue;
            }
          }
          if (decision?.action === 'skip') continue;
          stillUnmapped.push(field);
        }

        if (aiFilled > 0) {
          const saved = await saveProfile({ ...profile, answerBank: bank });
          void chrome.runtime.sendMessage({ type: 'CLOUD_PUSH', profile: saved });
        }
        result = {
          ...result,
          filledCount: result.filledCount + aiFilled,
          aiFilledCount: aiFilled,
          unmappedFields: stillUnmapped,
        };
      }
    } catch {
      // AI optional
    }
  }

  if (request.mode === 'easy_apply' && result.errors.length === 0 && !options?.skipWatch) {
    watchEasyApplySteps(request, async () => {
      const next = await runAutofillOnPage({ ...request, useAi: request.useAi }, { skipWatch: true });
      await persistLastAutofill(next, window.location.href);
    });
  }

  await persistLastAutofill(result, window.location.href);
  return result;
}

export { emptyAutofillResult };
