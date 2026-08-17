/** Extract hiring info from a LinkedIn feed post element. */

const EMAIL_RE = /[\w.-]+@[\w.-]+\.\w+/g;

export type LinkedInPostCapture = {
  emails: string[];
  company: string;
  role: string;
  recruiterName: string;
  description: string;
  sourceUrl: string;
};

function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function findPostRoot(): Element | null {
  const active = document.activeElement?.closest(
    '[data-urn*="activity"], .feed-shared-update-v2, [data-view-name*="feed-full-update"]',
  );
  if (active) return active;

  const posts = document.querySelectorAll(
    '[data-urn*="activity"], .feed-shared-update-v2, [data-view-name*="feed-full-update"]',
  );
  for (const post of posts) {
    const rect = post.getBoundingClientRect();
    if (rect.top >= 0 && rect.top < window.innerHeight * 0.6) {
      return post;
    }
  }
  return posts[0] ?? null;
}

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

function extractRole(text: string): string {
  const patterns = [
    /(?:we're hiring|hiring|opening|position|role|looking for|seeking)[:\s]+([^.!\n|]{3,60})/i,
    /(?:for the|for a)\s+([A-Za-z0-9 /,-]{3,50}?)\s+(?:position|role|opening|team)/i,
    /(?:hiring for|hiring a)\s+([A-Za-z0-9 /,-]{3,50})/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      let role = match[1].trim().replace(/^[:|\-\s]+/, '').replace(/[:|\-\s]+$/, '');
      if (role.length >= 3 && role.length <= 60) {
        return role;
      }
    }
  }

  // Fallback: check for common tech job titles in the post
  const commonTitles = [
    'Backend Developer', 'Backend Engineer', 'Frontend Developer', 'Frontend Engineer',
    'Fullstack Developer', 'Full Stack Engineer', 'Software Engineer', 'Software Developer',
    'Product Manager', 'Data Scientist', 'DevOps Engineer', 'Mobile Developer', 'Flutter Developer',
    'Android Developer', 'iOS Developer', 'QA Engineer', 'UI/UX Designer',
  ];
  for (const title of commonTitles) {
    if (new RegExp(`\\b${title}\\b`, 'i').test(text)) {
      return title;
    }
  }

  return 'Software Engineer';
}

function extractCompany(text: string, email?: string, authorHeadline?: string): string {
  // 1. Check text patterns
  const patterns = [
    /(?:at|@)\s+([A-Z][A-Za-z0-9&.'\s-]{2,30})/,
    /(?:join|work at|team at)\s+([A-Z][A-Za-z0-9&.'\s-]{2,30})/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      const comp = match[1].trim().replace(/\.$/, '');
      if (comp && !/the|a|an|our|my|this/i.test(comp)) return comp;
    }
  }

  // 2. Check author headline (e.g. "Associate Product Manager at agasty.ai")
  if (authorHeadline) {
    const headlineMatch = authorHeadline.match(/at\s+([A-Za-z0-9._-]+)/i);
    if (headlineMatch?.[1]) return headlineMatch[1];
  }

  // 3. Check email domain fallback (e.g. "prachi.mittal@agasty.ai" -> "agasty.ai")
  if (email) {
    const domain = email.split('@')[1];
    if (domain && !/gmail|yahoo|hotmail|outlook|icloud|proton/i.test(domain)) {
      return domain;
    }
  }

  const mention = text.match(/@([A-Za-z0-9._-]+)/);
  if (mention?.[1]) return mention[1];

  return '';
}

function extractRecruiterName(root: Element): string {
  const actorNameEl = root.querySelector(
    '.update-components-actor__name, .feed-shared-actor__name, [class*="actor__name"], span.hoverable-link-text',
  );
  return textOf(actorNameEl);
}

function extractAuthorHeadline(root: Element): string {
  const headlineEl = root.querySelector(
    '.update-components-actor__description, .feed-shared-actor__description, [class*="actor__description"]',
  );
  return textOf(headlineEl);
}

export function captureLinkedInPost(): LinkedInPostCapture | null {
  const root = findPostRoot();
  if (!root) return null;
  return captureLinkedInPostFromElement(root);
}

export function captureLinkedInPostFromElement(root: Element): LinkedInPostCapture | null {
  const description = textOf(root);
  if (description.length < 30) return null;

  const emails = extractEmails(description);
  const recruiterName = extractRecruiterName(root);
  const authorHeadline = extractAuthorHeadline(root);
  const role = extractRole(description);
  const email = emails[0] || '';
  const company = extractCompany(description, email, authorHeadline);

  const link = root.querySelector<HTMLAnchorElement>(
    'a[href*="/feed/update/"], a[href*="activity"], a[href*="/posts/"]',
  );
  const sourceUrl = link?.href ?? window.location.href;

  if (emails.length === 0 && !role && !company) {
    return null;
  }

  return {
    emails,
    company: company || 'Hiring Company',
    role: role || 'Open Position',
    recruiterName,
    description,
    sourceUrl,
  };
}
