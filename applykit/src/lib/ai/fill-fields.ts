import type { AnswerEntry, FieldFillDecision, ScannedField } from '@/types/answers';
import type { Profile } from '@/types/profile';
import { CERTIFY_QUESTION_RE, SENSITIVE_QUESTION_RE } from '@/lib/answers';
import type { AiSettings } from '@/types/ai-settings';

function compactProfile(profile: Profile): string {
  const d = profile.easyApplyDefaults;
  const latest = profile.experience[0];
  return [
    `Name: ${profile.personal.fullName}`,
    `Headline: ${profile.personal.headline}`,
    `Location: ${profile.personal.location}`,
    `Work authorized: ${d.authorizedToWork}; sponsorship: ${d.requiresSponsorship}; relocate: ${d.willingToRelocate}`,
    `Notice: ${d.noticePeriod || 'n/a'}; salary: ${d.expectedSalary || 'n/a'}`,
    `Work country: ${d.workCountry || 'n/a'}; start: ${d.earliestStartDate || 'n/a'}; arrangement: ${d.workArrangement || 'n/a'}`,
    `How heard: ${d.howHeard || 'n/a'}; know anyone: ${d.knowAnyoneAtCompany || 'n/a'}`,
    `Visa type: ${d.visaType || 'n/a'}`,
    `Current: ${d.currentTitle || latest?.title || 'n/a'} at ${d.currentCompany || latest?.company || 'n/a'}`,
    `EEO defaults: gender=${d.eeoGender}; race=${d.eeoRace}; veteran=${d.eeoVeteran}; disability=${d.eeoDisability}`,
    `Skills: ${profile.skills.map((s) => s.name).slice(0, 20).join(', ')}`,
    `Summary: ${profile.summary.slice(0, 400)}`,
  ].join('\n');
}

export function buildFillFieldsPrompt(
  profile: Profile,
  fields: ScannedField[],
  bank: AnswerEntry[],
): string {
  const bankLines = bank.slice(0, 80).map(
    (e) => `- Q: ${e.canonicalQuestion} | A: ${e.answer}`,
  );
  const fieldLines = fields.map((f, i) => {
    const opts = f.options?.length ? ` options=[${f.options.slice(0, 12).join(' | ')}]` : '';
    return `${i + 1}. "${f.question}" (${f.fieldType})${opts}`;
  });

  return `You fill job-application form fields honestly from the candidate profile and saved answers. Never invent employers, degrees, dates, or skills.

CANDIDATE
${compactProfile(profile)}

SAVED ANSWERS (reuse if the new question means the same thing)
${bankLines.length > 0 ? bankLines.join('\n') : '(none yet)'}

UNFILLED FIELDS
${fieldLines.join('\n')}

Return JSON only:
{ "decisions": [ { "question": "exact field question string", "action": "fill" | "ask" | "skip", "value": "string if fill", "reason": "short", "confidence": 0-100 } ] }

Rules:
- action=fill only when the value is clearly supported by the profile or saved answers.
- If the field is a dropdown, value MUST be one of the listed options (or Yes/No).
- action=ask for legal certify/attest, salary if no salary in profile, and any guess.
- action=skip when you cannot answer honestly.
- Sensitive topics (race, gender, disability, veteran) may fill only using the EEO defaults above.
- One decision per input field, same question text as given.`;
}

function parseDecisions(raw: string, fields: ScannedField[]): FieldFillDecision[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return fields.map((f) => ({ question: f.question, action: 'ask' as const }));
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return fields.map((f) => ({ question: f.question, action: 'ask' as const }));
    }
  }
  const obj = parsed as { decisions?: unknown };
  if (!Array.isArray(obj.decisions)) {
    return fields.map((f) => ({ question: f.question, action: 'ask' as const }));
  }

  const byQuestion = new Map<string, FieldFillDecision>();
  for (const item of obj.decisions) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const question = typeof rec.question === 'string' ? rec.question : '';
    if (!question) continue;
    const action = rec.action === 'fill' || rec.action === 'skip' ? rec.action : 'ask';
    let value = typeof rec.value === 'string' ? rec.value : undefined;
    if (action === 'fill' && CERTIFY_QUESTION_RE.test(question)) {
      byQuestion.set(question, {
        question,
        action: 'ask',
        reason: 'Needs your confirmation',
        confidence: typeof rec.confidence === 'number' ? rec.confidence : 0,
      });
      continue;
    }
    if (action === 'fill' && SENSITIVE_QUESTION_RE.test(question) && !/decline|eeo|gender|race|veteran|disability/i.test(question)) {
      byQuestion.set(question, {
        question,
        action: 'ask',
        reason: 'Needs your confirmation',
        confidence: typeof rec.confidence === 'number' ? rec.confidence : 0,
      });
      continue;
    }
    if (action === 'fill' && !value?.trim()) {
      byQuestion.set(question, { question, action: 'ask', reason: 'No value' });
      continue;
    }
    byQuestion.set(question, {
      question,
      action,
      value,
      reason: typeof rec.reason === 'string' ? rec.reason : undefined,
      confidence: typeof rec.confidence === 'number' ? rec.confidence : undefined,
    });
  }

  return fields.map((f) => byQuestion.get(f.question) ?? { question: f.question, action: 'ask' });
}

export async function callGeminiFillFields(
  settings: AiSettings,
  profile: Profile,
  fields: ScannedField[],
  bank: AnswerEntry[],
): Promise<{ ok: boolean; decisions: FieldFillDecision[]; error?: string }> {
  if (!settings.apiKey.trim() || !settings.enabled) {
    return { ok: false, decisions: fields.map((f) => ({ question: f.question, action: 'ask' })), error: 'AI disabled' };
  }
  if (fields.length === 0) {
    return { ok: true, decisions: [] };
  }

  const model = settings.model.trim() || 'gemini-3.7-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey.trim())}`;
  const prompt = buildFillFieldsPrompt(profile, fields, bank);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });
  } catch {
    return { ok: false, decisions: fields.map((f) => ({ question: f.question, action: 'ask' })), error: 'Network error' };
  }

  if (!response.ok) {
    return {
      ok: false,
      decisions: fields.map((f) => ({ question: f.question, action: 'ask' })),
      error: `Gemini error (${response.status})`,
    };
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return { ok: true, decisions: parseDecisions(text, fields) };
}
