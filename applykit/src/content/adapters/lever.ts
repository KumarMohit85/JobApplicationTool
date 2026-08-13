import { createJobContext } from '@/lib/job-context';
import type { JobContext } from '@/types/job';
import { findSectionByHeading, firstText, largestTextBlock } from './dom-utils';

const TITLE_SELECTORS = [
  '.posting-headline h2',
  'h2.posting-title',
  '.posting-title',
  'h1',
];

const COMPANY_SELECTORS = ['.posting-header .posting-category-title', '.main-header-logo img[alt]'];

const DESCRIPTION_SELECTORS = ['.posting-page .content', '.section-wrapper.page-full-width', '.content'];

export function isLeverHost(hostname: string): boolean {
  return hostname.includes('lever.co') || hostname.includes('jobs.lever.co');
}

export function extractLeverJob(url: string): JobContext | null {
  const title = firstText(TITLE_SELECTORS);
  let company = firstText(COMPANY_SELECTORS);
  if (!company) {
    const logo = document.querySelector('.main-header-logo img[alt]') as HTMLImageElement | null;
    company = logo?.alt?.trim() ?? '';
  }

  let description = firstText(DESCRIPTION_SELECTORS);
  if (!description) {
    description = findSectionByHeading(/description|requirements|about/i);
  }
  if (!description) {
    description = largestTextBlock(document.body, 120);
  }

  return createJobContext({ title, company, description, url, source: 'lever' });
}
