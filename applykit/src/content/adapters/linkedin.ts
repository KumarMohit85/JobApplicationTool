import { createJobContext } from '@/lib/job-context';
import type { JobContext } from '@/types/job';
import { findSectionByHeading, firstText, largestTextBlock, textOf } from './dom-utils';

const TITLE_SELECTORS = [
  '.job-details-jobs-unified-top-card__job-title',
  '.jobs-unified-top-card__job-title',
  'h1.t-24',
  'h1.top-card-layout__title',
  'h1',
];

const COMPANY_SELECTORS = [
  '.job-details-jobs-unified-top-card__company-name',
  '.jobs-unified-top-card__company-name',
  'a[href*="/company/"]',
  '.topcard__org-name-link',
];

const DESCRIPTION_SELECTORS = [
  '#job-details',
  '.jobs-description__content',
  '.jobs-box__html-content',
  '[class*="jobs-description"]',
  '[data-test-description-section]',
];

export function extractLinkedInJob(url: string): JobContext | null {
  const title = firstText(TITLE_SELECTORS);
  const company = firstText(COMPANY_SELECTORS);
  let description = firstText(DESCRIPTION_SELECTORS);

  if (!description) {
    description = findSectionByHeading(/description|about the job|overview/i);
  }
  if (!description) {
    description = largestTextBlock(document.body, 150);
  }

  return createJobContext({ title, company, description, url, source: 'linkedin' });
}

export function isLinkedInJobPage(url: string): boolean {
  return /linkedin\.com\/jobs\/view\//i.test(url) || /linkedin\.com\/jobs\/collections\//i.test(url);
}

export function isLinkedInHost(hostname: string): boolean {
  return hostname.includes('linkedin.com');
}

/** LinkedIn feed posts with hiring info — basic extraction for later F12. */
export function extractLinkedInPostText(): string {
  const article = document.activeElement?.closest('[data-urn*="activity"]') ?? document.querySelector('[data-urn*="activity"]');
  if (article) return textOf(article);
  return '';
}
