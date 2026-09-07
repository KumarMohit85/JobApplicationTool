import type { JobContext } from '@/types/job';
import { PAGE_SELECTION_STORAGE_KEY, type PageSelectionPayload } from '@/lib/job-context';
import { extractGenericJob } from './adapters/generic';
import { extractGreenhouseJob, isGreenhouseHost } from './adapters/greenhouse';
import { extractLeverJob, isLeverHost } from './adapters/lever';
import { extractLinkedInJob, isLinkedInHost } from './adapters/linkedin';

let lastSelectedText = '';
let lastSelectedAt = 0;

function selectionFromDocument(doc: Document): string {
  const sel = doc.getSelection()?.toString().trim() ?? '';
  if (sel) return sel;

  const el = doc.activeElement;
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'password')) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start != null && end != null && end > start) {
      return el.value.slice(start, end).trim();
    }
  }
  return '';
}

/** Live highlight, including input/textarea and same-origin iframes. */
export function readLiveSelection(): string {
  const top = selectionFromDocument(document);
  if (top) return top;

  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      const doc = iframe.contentDocument;
      if (!doc) continue;
      const nested = selectionFromDocument(doc);
      if (nested) return nested;
    } catch {
      // Cross-origin iframe
    }
  }
  return '';
}

function persistSelection(text: string): void {
  const trimmed = text.trim();
  if (trimmed.length < 3) return;
  lastSelectedText = trimmed;
  lastSelectedAt = Date.now();
  const payload: PageSelectionPayload = {
    text: trimmed,
    url: window.location.href,
    at: lastSelectedAt,
  };
  try {
    void chrome.storage.session.set({ [PAGE_SELECTION_STORAGE_KEY]: payload });
  } catch {
    // Extension context invalidated
  }
}

export function clearRememberedSelection(): void {
  lastSelectedText = '';
  lastSelectedAt = 0;
  try {
    void chrome.storage.session.remove(PAGE_SELECTION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const updateSelection = () => {
    persistSelection(readLiveSelection());
  };

  document.addEventListener('selectionchange', updateSelection);
  document.addEventListener('mouseup', updateSelection);
  document.addEventListener('pointerup', updateSelection);
  document.addEventListener('keyup', updateSelection);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'session' || !changes[PAGE_SELECTION_STORAGE_KEY]) return;
      if (!changes[PAGE_SELECTION_STORAGE_KEY].newValue) {
        lastSelectedText = '';
        lastSelectedAt = 0;
      }
    });
  } catch {
    // ignore
  }
}

export function extractJobContextFromPage(): JobContext | null {
  const url = window.location.href;
  const hostname = window.location.hostname;

  if (isLinkedInHost(hostname)) {
    return extractLinkedInJob(url);
  }
  if (isGreenhouseHost(hostname)) {
    return extractGreenhouseJob(url);
  }
  if (isLeverHost(hostname)) {
    return extractLeverJob(url);
  }
  return extractGenericJob(url);
}

export async function getSelectedTextFromPage(): Promise<{ text: string; at: number }> {
  const current = readLiveSelection();
  if (current) {
    persistSelection(current);
    return { text: current, at: lastSelectedAt };
  }
  if (lastSelectedText) {
    return { text: lastSelectedText, at: lastSelectedAt };
  }
  try {
    const stored = await chrome.storage.session.get(PAGE_SELECTION_STORAGE_KEY);
    const payload = stored[PAGE_SELECTION_STORAGE_KEY] as PageSelectionPayload | undefined;
    if (payload?.text) {
      lastSelectedText = payload.text;
      lastSelectedAt = payload.at;
      return { text: payload.text, at: payload.at };
    }
  } catch {
    // ignore
  }
  return { text: '', at: 0 };
}
