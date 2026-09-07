import { createId } from '@/lib/id';
import type { AnswerEntry, AnswerSource, AnswerType } from '@/types/answers';

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'for',
  'and',
  'or',
  'is',
  'are',
  'do',
  'you',
  'your',
  'have',
  'with',
  'this',
  'that',
  'please',
  'will',
]);

export function normalizeQuestion(text: string): string {
  return text
    .replace(/[*#]/g, '')
    .replace(/[?!.]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokens(text: string): string[] {
  return normalizeQuestion(text)
    .split(/\W+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/** Same meaning, different wording. */
export function questionsMatch(a: string, b: string): boolean {
  const na = normalizeQuestion(a);
  const nb = normalizeQuestion(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8 && (na.includes(nb) || nb.includes(na))) return true;

  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  const setB = new Set(tb);
  const common = ta.filter((t) => setB.has(t));
  const needed = Math.min(3, Math.min(ta.length, tb.length));
  return common.length >= needed;
}

export function inferAnswerType(answer: string, options?: string[]): AnswerType {
  if (options && options.length > 0) return 'select';
  const v = answer.trim().toLowerCase();
  if (v === 'yes' || v === 'no') return 'yes_no';
  if (/^\d+(\.\d+)?$/.test(v)) return 'number';
  if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) return 'date';
  return 'text';
}

export function findAnswerEntry(bank: AnswerEntry[], questionOrHints: string): AnswerEntry | null {
  if (!questionOrHints.trim()) return null;
  for (const entry of bank) {
    if (!entry.answer.trim()) continue;
    if (questionsMatch(entry.canonicalQuestion, questionOrHints)) return entry;
    if (entry.variants.some((v) => questionsMatch(v, questionOrHints))) return entry;
  }
  return null;
}

export function lookupAnswerValue(bank: AnswerEntry[], questionOrHints: string): string | null {
  return findAnswerEntry(bank, questionOrHints)?.answer.trim() || null;
}

export function upsertAnswer(
  bank: AnswerEntry[],
  question: string,
  answer: string,
  extras?: {
    source?: AnswerSource;
    options?: string[];
    siteHint?: string;
    incrementUse?: boolean;
  },
): AnswerEntry[] {
  const q = question.replace(/\s+/g, ' ').trim();
  const a = answer.trim();
  if (!q || !a) return bank;

  const existing = bank.find(
    (entry) => questionsMatch(entry.canonicalQuestion, q) || entry.variants.some((v) => questionsMatch(v, q)),
  );

  const now = new Date().toISOString();
  if (existing) {
    const variants = existing.variants.includes(q) || questionsMatch(existing.canonicalQuestion, q)
      ? existing.variants
      : [...existing.variants, q];
    return bank.map((entry) =>
      entry.id === existing.id
        ? {
            ...entry,
            answer: a,
            variants,
            options: extras?.options ?? entry.options,
            source: extras?.source ?? entry.source,
            siteHint: extras?.siteHint ?? entry.siteHint,
            timesUsed: extras?.incrementUse ? entry.timesUsed + 1 : entry.timesUsed,
            lastUsedAt: extras?.incrementUse ? now : entry.lastUsedAt,
            answerType: inferAnswerType(a, extras?.options ?? entry.options),
          }
        : entry,
    );
  }

  const created: AnswerEntry = {
    id: createId(),
    canonicalQuestion: q,
    variants: [],
    answer: a,
    answerType: inferAnswerType(a, extras?.options),
    options: extras?.options,
    source: extras?.source ?? 'learned',
    timesUsed: extras?.incrementUse ? 1 : 0,
    lastUsedAt: extras?.incrementUse ? now : undefined,
    siteHint: extras?.siteHint,
  };
  return [created, ...bank];
}

export function deleteAnswer(bank: AnswerEntry[], id: string): AnswerEntry[] {
  return bank.filter((entry) => entry.id !== id);
}

export function updateAnswer(
  bank: AnswerEntry[],
  id: string,
  patch: Partial<Pick<AnswerEntry, 'canonicalQuestion' | 'answer' | 'answerType'>>,
): AnswerEntry[] {
  return bank.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
}

export function migrateCustomAnswers(record: Record<string, string>): AnswerEntry[] {
  const bank: AnswerEntry[] = [];
  for (const [question, answer] of Object.entries(record)) {
    if (!question.trim() || !answer.trim()) continue;
    const next = upsertAnswer(bank, question, answer, { source: 'learned' });
    bank.length = 0;
    bank.push(...next);
  }
  return bank;
}

export function bankToCustomAnswers(bank: AnswerEntry[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const entry of bank) {
    if (!entry.answer.trim()) continue;
    record[entry.canonicalQuestion] = entry.answer;
    for (const variant of entry.variants) {
      record[variant] = entry.answer;
    }
  }
  return record;
}

export function normalizeAnswerBank(input: unknown): AnswerEntry[] {
  if (!Array.isArray(input)) return [];
  const result: AnswerEntry[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<AnswerEntry>;
    const canonical = typeof item.canonicalQuestion === 'string' ? item.canonicalQuestion.trim() : '';
    const answer = typeof item.answer === 'string' ? item.answer.trim() : '';
    if (!canonical || !answer) continue;
    result.push({
      id: typeof item.id === 'string' && item.id ? item.id : createId(),
      canonicalQuestion: canonical,
      variants: Array.isArray(item.variants)
        ? item.variants.map((v) => String(v).trim()).filter(Boolean)
        : [],
      answer,
      answerType:
        item.answerType === 'yes_no' ||
        item.answerType === 'number' ||
        item.answerType === 'select' ||
        item.answerType === 'date'
          ? item.answerType
          : 'text',
      options: Array.isArray(item.options) ? item.options.map(String) : undefined,
      source:
        item.source === 'settings' ||
        item.source === 'ai_suggested' ||
        item.source === 'user_confirmed'
          ? item.source
          : 'learned',
      timesUsed: typeof item.timesUsed === 'number' ? item.timesUsed : 0,
      lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : undefined,
      siteHint: typeof item.siteHint === 'string' ? item.siteHint : undefined,
    });
  }
  return result;
}

export function mergeAnswerBanks(primary: AnswerEntry[], extra: AnswerEntry[]): AnswerEntry[] {
  let bank = [...primary];
  for (const entry of extra) {
    bank = upsertAnswer(bank, entry.canonicalQuestion, entry.answer, {
      source: entry.source,
      options: entry.options,
      siteHint: entry.siteHint,
    });
    for (const variant of entry.variants) {
      bank = upsertAnswer(bank, variant, entry.answer, { source: entry.source });
    }
  }
  return bank;
}

export const SENSITIVE_QUESTION_RE =
  /\b(certify|attest|i agree|terms and conditions|i confirm that|equal opportunity|race|ethnicity|gender identity|sexual orientation|disability status|veteran status|hispanic|latino)\b/i;

/** Legal attestations — never auto-fill; user must tick these on the page. */
export const CERTIFY_QUESTION_RE =
  /\b(certify|attest|i agree|terms and conditions|i confirm that|privacy policy|i have read)\b/i;

export function isCertifyQuestion(text: string): boolean {
  return CERTIFY_QUESTION_RE.test(text);
}
