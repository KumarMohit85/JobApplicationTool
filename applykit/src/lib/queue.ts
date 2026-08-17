import { createId } from '@/lib/id';
import { QUEUE_STORAGE_KEY, type QueueItem, type QueueItemType, type QueueStatus } from '@/types/queue';

function normalizeQueueItem(input: Partial<QueueItem>): QueueItem | null {
  const company = typeof input.company === 'string' ? input.company.trim() : '';
  const role = typeof input.role === 'string' ? input.role.trim() : '';
  const sourceUrl = typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : '';
  if (!company && !role && !sourceUrl) return null;

  const id = typeof input.id === 'string' && input.id ? input.id : createId();
  const now = new Date().toISOString();

  return {
    id,
    type: input.type === 'linkedin_mail' ? 'linkedin_mail' : 'job_scan',
    status: (['pending', 'sent', 'applied'] as QueueStatus[]).includes(input.status as QueueStatus)
      ? (input.status as QueueStatus)
      : 'pending',
    email: typeof input.email === 'string' ? input.email.trim() : undefined,
    applyUrl: typeof input.applyUrl === 'string' ? input.applyUrl.trim() : undefined,
    company,
    role,
    description: typeof input.description === 'string' ? input.description : '',
    sourceUrl,
    resumeId: typeof input.resumeId === 'string' ? input.resumeId : undefined,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : now,
  };
}

function normalizeQueueList(input: unknown): QueueItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeQueueItem(item as Partial<QueueItem>))
    .filter((item): item is QueueItem => item != null);
}

export async function listQueue(): Promise<QueueItem[]> {
  const result = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  return normalizeQueueList(result[QUEUE_STORAGE_KEY]);
}

async function saveQueueList(items: QueueItem[]): Promise<QueueItem[]> {
  const normalized = normalizeQueueList(items);
  await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: normalized });
  return normalized;
}

export function isQueueDuplicate(
  items: QueueItem[],
  candidate: { email?: string; company: string; role: string; sourceUrl: string },
): boolean {
  const email = candidate.email?.trim().toLowerCase();
  const company = candidate.company.trim().toLowerCase();
  const role = candidate.role.trim().toLowerCase();
  const sourceUrl = candidate.sourceUrl.trim();

  return items.some((item) => {
    if (sourceUrl && item.sourceUrl === sourceUrl) return true;
    if (email && item.email?.toLowerCase() === email && company && item.company.toLowerCase() === company && role && item.role.toLowerCase() === role) {
      return true;
    }
    return false;
  });
}

export async function addQueueItem(input: {
  type: QueueItemType;
  email?: string;
  applyUrl?: string;
  company: string;
  role: string;
  description: string;
  sourceUrl: string;
  resumeId?: string;
  status?: QueueStatus;
}): Promise<{ item: QueueItem | null; duplicate: boolean }> {
  const existing = await listQueue();
  if (isQueueDuplicate(existing, input)) {
    return { item: null, duplicate: true };
  }

  const item = normalizeQueueItem({
    ...input,
    status: input.status ?? 'pending',
  });
  if (!item) return { item: null, duplicate: false };

  await saveQueueList([item, ...existing]);
  return { item, duplicate: false };
}

export async function updateQueueItem(
  id: string,
  patch: Partial<Omit<QueueItem, 'id' | 'createdAt'>>,
): Promise<QueueItem | null> {
  const existing = await listQueue();
  const index = existing.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updated = normalizeQueueItem({
    ...existing[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return null;

  const next = [...existing];
  next[index] = updated;
  await saveQueueList(next);
  return updated;
}

export async function deleteQueueItem(id: string): Promise<void> {
  const existing = await listQueue();
  await saveQueueList(existing.filter((item) => item.id !== id));
}

export async function importQueueItems(
  incoming: Partial<QueueItem>[],
): Promise<{ added: number; updated: number; skipped: number }> {
  const existing = await listQueue();
  const byId = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const partial of incoming) {
    const normalized = normalizeQueueItem(partial);
    if (!normalized) {
      skipped += 1;
      continue;
    }

    const existingById = partial.id ? byId.get(partial.id) : undefined;
    const duplicate = existing.find(
      (item) =>
        item.id !== normalized.id &&
        isQueueDuplicate([item], {
          email: normalized.email,
          company: normalized.company,
          role: normalized.role,
          sourceUrl: normalized.sourceUrl,
        }),
    );

    if (existingById) {
      byId.set(existingById.id, normalizeQueueItem({ ...existingById, ...partial, updatedAt: new Date().toISOString() })!);
      updated += 1;
    } else if (duplicate) {
      skipped += 1;
    } else {
      byId.set(normalized.id, normalized);
      added += 1;
    }
  }

  await saveQueueList([...byId.values()]);
  return { added, updated, skipped };
}

export async function replaceQueue(items: QueueItem[]): Promise<QueueItem[]> {
  return saveQueueList(items);
}
