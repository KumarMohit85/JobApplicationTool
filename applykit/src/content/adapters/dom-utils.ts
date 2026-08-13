/** DOM helpers shared by content-script adapters. */

export function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function firstText(selectors: string[]): string {
  for (const selector of selectors) {
    const value = textOf(document.querySelector(selector));
    if (value) return value;
  }
  return '';
}

export function firstTextFrom(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const value = textOf(root.querySelector(selector));
    if (value) return value;
  }
  return '';
}

export function largestTextBlock(root: ParentNode, minLength = 200): string {
  let best = '';
  const candidates = root.querySelectorAll('section, article, main, div, p');
  for (const el of candidates) {
    const text = textOf(el);
    if (text.length > best.length && text.length >= minLength) {
      best = text;
    }
  }
  return best;
}

export function parseTitleTag(title: string): { title: string; company: string } {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  // "Software Engineer at Acme | LinkedIn" or "Role - Company - Site"
  const atMatch = cleaned.match(/^(.+?)\s+at\s+(.+?)(?:\s+[|\-–—]\s+|$)/i);
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() };
  }
  const dashParts = cleaned.split(/\s[|\-–—]\s/);
  if (dashParts.length >= 2) {
    return { title: dashParts[0].trim(), company: dashParts[1].trim() };
  }
  return { title: cleaned, company: '' };
}

export function findSectionByHeading(keywords: RegExp): string {
  const headings = document.querySelectorAll('h1, h2, h3, h4, strong, b');
  for (const heading of headings) {
    const label = textOf(heading);
    if (!keywords.test(label)) continue;

    const section =
      heading.closest('section, article, div') ??
      heading.parentElement ??
      heading.nextElementSibling;
    if (!section) continue;

    const text = textOf(section);
    if (text.length > 80) return text;
  }
  return '';
}
