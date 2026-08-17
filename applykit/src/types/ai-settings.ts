export const AI_SETTINGS_STORAGE_KEY = 'applykit_ai_settings';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

export type AiSettings = {
  enabled: boolean;
  apiKey: string;
  model: string;
};

export function createDefaultAiSettings(): AiSettings {
  return {
    enabled: false,
    apiKey: '',
    model: DEFAULT_GEMINI_MODEL,
  };
}
