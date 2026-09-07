import type { QueueItem } from '@/types/queue';
import { listQueue } from '@/lib/queue';

export const ACTIVE_APPLY_STORAGE_KEY = 'applykit_active_apply';

export type ActiveApplySession = {
  queueItemId: string;
  tabId: number;
};

export async function getActiveApplySession(): Promise<ActiveApplySession | null> {
  const result = await chrome.storage.session.get(ACTIVE_APPLY_STORAGE_KEY);
  const stored = result[ACTIVE_APPLY_STORAGE_KEY] as ActiveApplySession | undefined;
  return stored?.queueItemId ? stored : null;
}

export async function clearActiveApplySession(): Promise<void> {
  await chrome.storage.session.remove(ACTIVE_APPLY_STORAGE_KEY);
}

export function applyUrlOf(item: QueueItem): string | undefined {
  return item.applyUrl || item.applyUrls?.[0] || (item.sourceUrl.startsWith('http') ? item.sourceUrl : undefined);
}

export function isLinkApplyItem(item: QueueItem): boolean {
  return Boolean(applyUrlOf(item)) && item.status === 'pending';
}

/** Open the apply URL, side panel, and ask the background to fill when the page is ready. */
export async function startQueuedFormApply(
  item: QueueItem,
  urlOverride?: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = urlOverride || applyUrlOf(item);
  if (!url) {
    return { ok: false, error: 'This queue row has no apply link.' };
  }

  const tab = await chrome.tabs.create({ url, active: true });
  if (!tab.id) {
    return { ok: false, error: 'Could not open a tab.' };
  }

  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch {
    // Side panel may still open from the toolbar
  }

  await chrome.storage.session.set({
    [ACTIVE_APPLY_STORAGE_KEY]: { queueItemId: item.id, tabId: tab.id } satisfies ActiveApplySession,
  });

  void chrome.runtime.sendMessage({ type: 'FILL_TAB_WHEN_READY', tabId: tab.id });
  return { ok: true };
}

export async function findNextPendingLinkApply(afterId?: string): Promise<QueueItem | null> {
  const items = await listQueue();
  const pending = items.filter(isLinkApplyItem);
  if (pending.length === 0) return null;
  if (!afterId) return pending[0] ?? null;

  const allIdx = items.findIndex((item) => item.id === afterId);
  if (allIdx < 0) return pending[0] ?? null;
  for (let i = allIdx + 1; i < items.length; i += 1) {
    const candidate = items[i];
    if (candidate && isLinkApplyItem(candidate)) return candidate;
  }
  return null;
}
