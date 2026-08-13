import type { JobContext } from '@/types/job';
import { extractGenericJob } from './adapters/generic';
import { extractGreenhouseJob, isGreenhouseHost } from './adapters/greenhouse';
import { extractLeverJob, isLeverHost } from './adapters/lever';
import { extractLinkedInJob, isLinkedInJobPage } from './adapters/linkedin';

export function extractJobContextFromPage(): JobContext | null {
  const url = window.location.href;
  const hostname = window.location.hostname;

  if (isLinkedInJobPage(url)) {
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
  return window.getSelection()?.toString().trim() ?? '';
}
