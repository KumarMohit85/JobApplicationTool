export type AnswerType = 'text' | 'yes_no' | 'number' | 'select' | 'date';

export type AnswerSource = 'settings' | 'learned' | 'ai_suggested' | 'user_confirmed';

export type AnswerEntry = {
  id: string;
  canonicalQuestion: string;
  variants: string[];
  answer: string;
  answerType: AnswerType;
  options?: string[];
  source: AnswerSource;
  timesUsed: number;
  lastUsedAt?: string;
  siteHint?: string;
};

export type ScannedField = {
  question: string;
  fieldType: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'date' | 'number';
  options?: string[];
  currentValue?: string;
  mappedKey?: string;
};

export type FieldFillDecision = {
  question: string;
  action: 'fill' | 'ask' | 'skip';
  value?: string;
  reason?: string;
  confidence?: number;
};
