/** Extract hiring info from a LinkedIn feed post element. */

const EMAIL_RE = /[\w.-]+@[\w.-]+\.\w+/g;

export type LinkedInPostCapture = {
  emails: string[];
  company: string;
  role: string;
  description: string;
  sourceUrl: string;
};

function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function findPostRoot(): Element | null {
  const active = document.activeElement?.closest('[data-urn*="activity"], .feed-shared-update-v2');
  if (active) return active;

  const posts = document.querySelectorAll('[data-urn*="activity"], .feed-shared-update-v2');
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
    /(?:hiring|opening|position|role|looking for|seeking)[:\s]+([^.!\n]{5,80})/i,
    /(?:for the|for a)\s+([A-Za-z0-9 /,-]{5,60}?)\s+(?:position|role|opening)/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractCompany(text: string): string {
  const patterns = [
    /(?:at|@)\s+([A-Z][A-Za-z0-9&.'\s-]{2,40})/,
    /(?:join|work at|team at)\s+([A-Z][A-Za-z0-9&.'\s-]{2,40})/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) return match[1].trim().replace(/\.$/, '');
  }

  const mention = text.match(/@([A-Za-z0-9._-]+)/);
  if (mention?.[1]) return mention[1];

  return '';
}

export function captureLinkedInPost(): LinkedInPostCapture | null {
  const root = findPostRoot();
  if (!root) return null;

  const description = textOf(root);
  if (description.length < 40) return null;

  const emails = extractEmails(description);
  const role = extractRole(description);
  const company = extractCompany(description);
  const link = root.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"], a[href*="activity"]');
  const sourceUrl = link?.href ?? window.location.href;

  if (emails.length === 0 && !role && !company) {
    return null;
  }

  return { emails, company, role, description, sourceUrl };
}
