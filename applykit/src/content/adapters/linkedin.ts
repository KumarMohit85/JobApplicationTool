import { createJobContext } from '@/lib/job-context';
import type { JobContext } from '@/types/job';
import { findSectionByHeading, firstText, textOf } from './dom-utils';
import { captureLinkedInPostFromElement, findPostRoot } from '../post-capture';

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

export function isLinkedInJobPage(url: string): boolean {
  return /linkedin\.com\/jobs\/(view|collections|search)/i.test(url);
}

export function isLinkedInHost(hostname: string): boolean {
  return hostname.includes('linkedin.com');
}

/** Extract job details from official LinkedIn job postings (/jobs/view/...). */
function extractOfficialJob(url: string): JobContext | null {
  const title = firstText(TITLE_SELECTORS) || 'Job Position';
  const company = firstText(COMPANY_SELECTORS) || 'LinkedIn Job';
  let description = firstText(DESCRIPTION_SELECTORS);

  if (!description) {
    description = findSectionByHeading(/description|about the job|overview|requirements/i);
  }

  return createJobContext({ title, company, description, url, source: 'linkedin' });
}

/** Extract job details intelligently from a single visible LinkedIn feed post / post card. */
function extractLinkedInFeedPost(url: string): JobContext | null {
  // Check if user has text selected first
  const selection = window.getSelection()?.toString().trim();
  if (selection && selection.length >= 20) {
    return createJobContext({
      title: 'Selected Job Post',
      company: 'LinkedIn',
      description: selection,
      url,
      source: 'linkedin',
    });
  }

  // Find target post element in viewport
  const postRoot = findPostRoot();
  if (!postRoot) return null;

  // Try extracting structured info (email, role, company)
  const capture = captureLinkedInPostFromElement(postRoot);

  // Extract clean post body text (excluding comments, sidebars, like buttons)
  const contentEl =
    postRoot.querySelector(
      '.feed-shared-update-v2__description, .update-components-text, .feed-shared-text, [class*="update-v2__description"]',
    ) ?? postRoot;

  let description = textOf(contentEl);

  // If content element text is very short, fallback to textOf(postRoot)
  if (description.length < 30) {
    description = textOf(postRoot);
  }

  const title = capture?.role || 'LinkedIn Hiring Post';
  const company = capture?.company || 'LinkedIn';
  const postUrl = capture?.sourceUrl || url;

  return createJobContext({
    title,
    company,
    description,
    url: postUrl,
    source: 'linkedin',
  });
}

export function extractLinkedInJob(url: string): JobContext | null {
  if (isLinkedInJobPage(url)) {
    return extractOfficialJob(url);
  }
  return extractLinkedInFeedPost(url);
}
