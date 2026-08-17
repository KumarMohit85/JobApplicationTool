import type { AiGenerateResponse, AiGeneratedContent, AiJobReview, AiDecision } from '@/types/ai';

/** Strip markdown fences Gemini sometimes adds despite responseMimeType: application/json */
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

function parseDecision(raw: unknown): AiDecision {
  if (raw === 'apply' || raw === 'maybe' || raw === 'skip') return raw;
  return 'maybe';
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

function parseReview(obj: Record<string, unknown>): AiJobReview {
  return {
    decision: parseDecision(obj['decision']),
    confidence: typeof obj['confidence'] === 'number' ? Math.round(obj['confidence']) : 50,
    reasons: parseStringArray(obj['reasons']),
    risks: parseStringArray(obj['risks']),
    recommendedResumeId:
      typeof obj['recommendedResumeId'] === 'string' ? obj['recommendedResumeId'] : undefined,
    recommendedResumeReason:
      typeof obj['recommendedResumeReason'] === 'string'
        ? obj['recommendedResumeReason']
        : undefined,
  };
}

function parseContent(obj: Record<string, unknown>): AiGeneratedContent {
  const coldEmail =
    obj['coldEmail'] && typeof obj['coldEmail'] === 'object'
      ? (obj['coldEmail'] as Record<string, unknown>)
      : {};

  return {
    fitParagraph: typeof obj['fitParagraph'] === 'string' ? obj['fitParagraph'] : '',
    coverLetter: typeof obj['coverLetter'] === 'string' ? obj['coverLetter'] : '',
    coldEmail: {
      subject: typeof coldEmail['subject'] === 'string' ? coldEmail['subject'] : '',
      body: typeof coldEmail['body'] === 'string' ? coldEmail['body'] : '',
    },
  };
}

export function parseAiResponse(
  rawText: string,
  mode: 'content' | 'review',
): AiGenerateResponse {
  let obj: Record<string, unknown>;
  try {
    const cleaned = stripFences(rawText);
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Gemini returned unexpected JSON structure.' };
    }
    obj = parsed as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `Could not parse Gemini response as JSON. Raw: ${rawText.slice(0, 120)}`,
    };
  }

  if (mode === 'review') {
    return { ok: true, review: parseReview(obj) };
  }

  return { ok: true, content: parseContent(obj) };
}
