export const AI_SETTINGS_STORAGE_KEY = 'applykit_ai_settings';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

export type AiSettings = {
  enabled: boolean;
  apiKey: string;
  model: string;
  customEmailPrompt?: string;
};

export function createDefaultAiSettings(): AiSettings {
  return {
    enabled: false,
    apiKey: '',
    model: DEFAULT_GEMINI_MODEL,
    customEmailPrompt:
      'Keep the email concise (120-180 words), direct, and engaging. Highlight top matching skills between the candidate profile and the job description. End with a polite request for a brief intro call.',
  };
}
