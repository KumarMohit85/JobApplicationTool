import { createJobContext } from '@/lib/job-context';
import type { JobContext } from '@/types/job';
import { findSectionByHeading, largestTextBlock, parseTitleTag, textOf } from './dom-utils';

export function extractGenericJob(url: string): JobContext | null {
  const parsed = parseTitleTag(document.title);
  let title = parsed.title;
  let company = parsed.company;

  const h1 = textOf(document.querySelector('h1'));
  if (h1 && h1.length < 120) {
    title = h1;
  }

  const metaCompany =
    document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ??
    document.querySelector('meta[name="application-name"]')?.getAttribute('content') ??
    '';
  if (!company && metaCompany) {
    company = metaCompany.trim();
  }

  let description = findSectionByHeading(/job description|description|requirements|about the role|responsibilities/i);
  if (!description) {
    description = largestTextBlock(document.querySelector('main') ?? document.body, 200);
  }

  return createJobContext({
    title,
    company,
    description,
    url,
    source: 'generic',
  });
}
