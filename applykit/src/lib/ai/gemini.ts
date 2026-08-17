import type { AiSettings } from '@/types/ai-settings';
import type { AiGenerateRequest, AiGenerateResponse } from '@/types/ai';
import { buildAiPrompt } from './prompts';
import { parseAiResponse } from './parse';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Current recommended model (updated August 2026). */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

/**
 * Map old/deprecated model IDs to their current working equivalents.
 * Updated August 2026: Gemini 3.x series is now the standard.
 */
const MODEL_ALIASES: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-3.7-flash',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.7-flash',
  'gemini-2.5-pro': 'gemini-3.7-flash',
  'gemini-1.5-flash': 'gemini-3.7-flash',
  'gemini-1.5-flash-latest': 'gemini-3.7-flash',
  'gemini-1.5-pro': 'gemini-3.7-flash',
  'gemini-1.5-pro-latest': 'gemini-3.7-flash',
  'gemini-pro': 'gemini-3.7-flash',
  'gemini-1.0-pro': 'gemini-3.7-flash',
};

function normalizeModel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_GEMINI_MODEL;
  return MODEL_ALIASES[trimmed] ?? trimmed;
}

/** Fetch the list of model IDs that support generateContent for the given API key. */
export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  const url = `${GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=50`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to list models: HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  return (
    data.models
      ?.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      ?? []
  );
}

export async function callGemini(
  settings: AiSettings,
  request: AiGenerateRequest,
): Promise<AiGenerateResponse> {
  if (!settings.apiKey.trim()) {
    return { ok: false, error: 'Add your Gemini API key in Options → AI settings.' };
  }
  if (!settings.enabled) {
    return { ok: false, error: 'Enable AI in Options → AI settings.' };
  }

  const model = normalizeModel(settings.model);
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey.trim())}`;

  const prompt = buildAiPrompt(request);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
    });
  } catch {
    return { ok: false, error: 'Network error calling Gemini. Check your connection.' };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 429) {
      return { ok: false, error: 'Gemini rate limit reached. Wait a moment and try again.' };
    }
    if (response.status === 400 || response.status === 403) {
      return { ok: false, error: 'Invalid API key or model. Check AI settings.' };
    }
    return { ok: false, error: `Gemini error (${response.status}). ${detail.slice(0, 120)}` };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'Invalid response from Gemini.' };
  }

  const text =
    (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts?.[0]?.text ?? '';

  if (!text.trim()) {
    return { ok: false, error: 'Gemini returned empty content.' };
  }

  return parseAiResponse(text, request.mode);
}

export async function testGeminiConnection(settings: AiSettings): Promise<{ ok: boolean; error?: string }> {
  const result = await callGemini(settings, {
    mode: 'review',
    profile: {
      version: 1,
      personal: {
        fullName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '',
        location: '',
        linkedIn: '',
        github: '',
        portfolio: '',
        headline: 'Engineer',
      },
      summary: 'Test profile for API connection.',
      skills: [],
      experience: [],
      education: [],
      easyApplyDefaults: {
        authorizedToWork: 'Yes',
        requiresSponsorship: 'No',
        willingToRelocate: 'Yes',
        customAnswers: {},
      },
      updatedAt: new Date().toISOString(),
    },
    job: {
      title: 'Software Engineer',
      company: 'Acme',
      description: 'Looking for JavaScript experience.',
      url: 'https://example.com/job',
      source: 'generic',
      extractedAt: new Date().toISOString(),
    },
    matchedSkillNames: ['JavaScript'],
    resumes: [],
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}
