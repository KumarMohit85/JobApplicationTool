import { createId } from '@/lib/id';
import { resolveJobRequirements } from '@/lib/post-parser';
import { QUEUE_STORAGE_KEY, type QueueItem, type QueueItemType, type QueueStatus } from '@/types/queue';

export const QUEUE_DESCRIPTION_MAX = 8000;

const GENERIC_COMPANY = new Set([
  'hiring company',
  'linkedin',
  'unknown company',
  'company name',
  'selected job post',
]);

const GENERIC_ROLE = new Set([
  'open position',
  'unknown role',
  'role title',
  'job position',
  'selected job post',
]);

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'li_fat_id',
  'trk',
  'trackingid',
]);

/** Prefer the longest real JD so mail/AI generation has enough context. */
export function resolveQueueDescription(...parts: Array<string | undefined>): string {
  let best = '';
  for (const part of parts) {
    const text = (part ?? '').trim();
    if (text.length > best.length) best = text;
  }
  return best.slice(0, QUEUE_DESCRIPTION_MAX);
}

function normalizeUrlForDedupe(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    const path = parsed.pathname.replace(/\/+$/, '') || '';
    const search = parsed.searchParams.toString();
    return `${parsed.origin.toLowerCase()}${path.toLowerCase()}${search ? `?${search}` : ''}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

function collectApplyUrls(item: { applyUrl?: string; applyUrls?: string[] }): string[] {
  const urls = [...(item.applyUrls ?? [])];
  if (item.applyUrl) urls.push(item.applyUrl);
  return [...new Set(urls.map(normalizeUrlForDedupe).filter(Boolean))];
}

function isSpecificLabel(value: string, generic: Set<string>): boolean {
  const v = value.trim().toLowerCase();
  return Boolean(v) && !generic.has(v);
}

function normalizeContactNumbers(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const normalized = [
    ...new Set(
      input
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
  return normalized.length > 0 ? normalized : undefined;
}

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
    phoneNumbers: normalizeContactNumbers(input.phoneNumbers),
    whatsappNumbers: normalizeContactNumbers(input.whatsappNumbers),
    applyUrl: typeof input.applyUrl === 'string' ? input.applyUrl.trim() : undefined,
    applyUrls: Array.isArray(input.applyUrls)
      ? input.applyUrls.map((u) => String(u).trim()).filter(Boolean)
      : typeof input.applyUrl === 'string' && input.applyUrl.trim()
        ? [input.applyUrl.trim()]
        : undefined,
    company,
    role,
    description: resolveQueueDescription(input.description),
    requirements: resolveJobRequirements(input.requirements, input.description) || undefined,
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
  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      void chrome.runtime.sendMessage({ type: 'CLOUD_PUSH_QUEUE', queueItems: normalized });
    } catch {
      // silent fallback
    }
  }
  return normalized;
}

export function isQueueDuplicate(
  items: QueueItem[],
  candidate: {
    email?: string;
    company: string;
    role: string;
    sourceUrl: string;
    applyUrl?: string;
    applyUrls?: string[];
    phoneNumbers?: string[];
    whatsappNumbers?: string[];
  },
): boolean {
  const email = candidate.email?.trim().toLowerCase() ?? '';
  const company = candidate.company.trim().toLowerCase();
  const role = candidate.role.trim().toLowerCase();
  const companySpecific = isSpecificLabel(company, GENERIC_COMPANY);
  const roleSpecific = isSpecificLabel(role, GENERIC_ROLE);
  const candidateApply = collectApplyUrls(candidate);
  const candidateWhatsApp = new Set(
    (candidate.whatsappNumbers ?? []).map((number) => number.replace(/\D/g, '')).filter(Boolean),
  );
  const sourceUrl = normalizeUrlForDedupe(candidate.sourceUrl);

  return items.some((item) => {
    const itemApply = collectApplyUrls(item);
    if (candidateApply.length > 0 && itemApply.some((url) => candidateApply.includes(url))) {
      return true;
    }

    const itemEmail = item.email?.trim().toLowerCase() ?? '';
    const itemCompany = item.company.trim().toLowerCase();
    const itemRole = item.role.trim().toLowerCase();
    const itemSource = normalizeUrlForDedupe(item.sourceUrl);
    const sameWhatsApp = (item.whatsappNumbers ?? []).some((number) =>
      candidateWhatsApp.has(number.replace(/\D/g, '')),
    );

    if (
      email &&
      itemEmail &&
      email === itemEmail &&
      companySpecific &&
      roleSpecific &&
      itemCompany === company &&
      itemRole === role
    ) {
      return true;
    }

    if (
      sameWhatsApp &&
      companySpecific &&
      roleSpecific &&
      itemCompany === company &&
      itemRole === role
    ) {
      return true;
    }

    // Same feed post is not enough — one post often lists several jobs.
    if (
      sourceUrl &&
      itemSource &&
      sourceUrl === itemSource &&
      companySpecific &&
      roleSpecific &&
      itemCompany === company &&
      itemRole === role
    ) {
      return true;
    }

    return false;
  });
}

export async function addQueueItem(input: {
  type: QueueItemType;
  email?: string;
  phoneNumbers?: string[];
  whatsappNumbers?: string[];
  applyUrl?: string;
  applyUrls?: string[];
  company: string;
  role: string;
  description: string;
  requirements?: string;
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
    description: resolveQueueDescription(input.description),
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
  await deleteQueueItems([id]);
}

export async function deleteQueueItems(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const idSet = new Set(ids);
  const existing = await listQueue();
  const next = existing.filter((item) => !idSet.has(item.id));
  await saveQueueList(next);
  return existing.length - next.length;
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
          applyUrl: normalized.applyUrl,
          applyUrls: normalized.applyUrls,
          phoneNumbers: normalized.phoneNumbers,
          whatsappNumbers: normalized.whatsappNumbers,
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
