import type { JobContext } from '@/types/job';
import { extractGenericJob } from './adapters/generic';
import { extractGreenhouseJob, isGreenhouseHost } from './adapters/greenhouse';
import { extractLeverJob, isLeverHost } from './adapters/lever';
import { extractLinkedInJob, isLinkedInHost } from './adapters/linkedin';
import { captureLinkedInPost } from './post-capture';

let lastSelectedText = '';

// Track user text selection on the page in real-time so it survives focus loss when clicking sidepanel
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const updateSelection = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 3) {
      lastSelectedText = sel;
    }
  };

  document.addEventListener('selectionchange', updateSelection);
  document.addEventListener('mouseup', updateSelection);
  document.addEventListener('keyup', updateSelection);
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

export function getSelectedTextFromPage(): string {
  // 1. Try current active window selection
  const current = window.getSelection()?.toString().trim();
  if (current && current.length > 0) {
    lastSelectedText = current;
    return current;
  }

  // 2. Try last remembered selection before Side Panel stole focus
  if (lastSelectedText && lastSelectedText.length > 0) {
    return lastSelectedText;
  }

  // 3. Fallback for LinkedIn: Auto-capture visible post content if no manual selection exists
  if (typeof window !== 'undefined' && /linkedin\.com/i.test(window.location.hostname)) {
    try {
      const capture = captureLinkedInPost();
      if (capture?.description && capture.description.length > 20) {
        return capture.description;
      }
    } catch {
      // ignore
    }
  }

  return '';
}
