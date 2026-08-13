import { createJobContext } from '@/lib/job-context';
import type { JobContext } from '@/types/job';
import { findSectionByHeading, firstText, largestTextBlock } from './dom-utils';

const TITLE_SELECTORS = [
  '.app-title',
  'h1.heading',
  '#header h1',
  '[data-qa="job-title"]',
  'h1',
];

const COMPANY_SELECTORS = ['#header .company-name', '.company-name', '[data-qa="company-name"]'];

const DESCRIPTION_SELECTORS = [
  '#content',
  '.job-post-content',
  '.content',
  '[data-qa="job-description"]',
];

export function isGreenhouseHost(hostname: string): boolean {
  return hostname.includes('greenhouse.io');
}

export function extractGreenhouseJob(url: string): JobContext | null {
  const title = firstText(TITLE_SELECTORS);
  const company = firstText(COMPANY_SELECTORS);
  let description = firstText(DESCRIPTION_SELECTORS);

  if (!description) {
    description = findSectionByHeading(/description|requirements|about/i);
  }
  if (!description) {
    description = largestTextBlock(document.body, 120);
  }

  return createJobContext({ title, company, description, url, source: 'greenhouse' });
}
