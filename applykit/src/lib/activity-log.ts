import { createId } from '@/lib/id';
import {
  ACTIVITY_LOG_STORAGE_KEY,
  type ActivityAction,
  type ActivityEntry,
} from '@/types/activity';

const MAX_ENTRIES = 500;

function normalizeEntry(input: Partial<ActivityEntry>): ActivityEntry | null {
  const action = input.action;
  if (!action || !['easy_apply_fill', 'form_fill', 'email_sent', 'job_applied', 'queued'].includes(action)) {
    return null;
  }

  return {
    id: typeof input.id === 'string' && input.id ? input.id : createId(),
    action: action as ActivityAction,
    company: typeof input.company === 'string' ? input.company : '',
    role: typeof input.role === 'string' ? input.role : '',
    url: typeof input.url === 'string' ? input.url : '',
    resumeId: typeof input.resumeId === 'string' ? input.resumeId : undefined,
    resumeName: typeof input.resumeName === 'string' ? input.resumeName : undefined,
    timestamp: typeof input.timestamp === 'string' ? input.timestamp : new Date().toISOString(),
  };
}

export async function listActivityLog(): Promise<ActivityEntry[]> {
  const result = await chrome.storage.local.get(ACTIVITY_LOG_STORAGE_KEY);
  const stored = result[ACTIVITY_LOG_STORAGE_KEY];
  if (!Array.isArray(stored)) return [];
  return stored
    .map((item) => normalizeEntry(item as Partial<ActivityEntry>))
    .filter((item): item is ActivityEntry => item != null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function appendActivityLog(
  input: Omit<ActivityEntry, 'id' | 'timestamp'> & { timestamp?: string },
): Promise<ActivityEntry | null> {
  const entry = normalizeEntry({ ...input, id: createId(), timestamp: new Date().toISOString() });
  if (!entry) return null;

  const existing = await listActivityLog();
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  await chrome.storage.local.set({ [ACTIVITY_LOG_STORAGE_KEY]: next });
  return entry;
}

export async function clearActivityLog(): Promise<void> {
  await chrome.storage.local.remove(ACTIVITY_LOG_STORAGE_KEY);
}

export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  easy_apply_fill: 'Easy Apply fill',
  form_fill: 'Form fill',
  email_sent: 'Email sent',
  job_applied: 'Direct link applied',
  queued: 'Saved to queue',
};
