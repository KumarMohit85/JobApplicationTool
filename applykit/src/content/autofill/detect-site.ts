export type AutofillSite = 'linkedin' | 'greenhouse' | 'lever' | 'generic';

export function detectAutofillSite(hostname: string): AutofillSite {
  if (hostname.includes('linkedin.com')) return 'linkedin';
  if (hostname.includes('greenhouse.io')) return 'greenhouse';
  if (hostname.includes('lever.co')) return 'lever';
  return 'generic';
}

export function isLinkedInEasyApplyPage(hostname: string): boolean {
  return hostname.includes('linkedin.com');
}
