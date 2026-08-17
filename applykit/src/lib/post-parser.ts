/**
 * Smart parser for LinkedIn hiring posts.
 * Extracts structured job entries (company, role, email, apply URLs)
 * from free-text posts, including multi-job and multi-link posts.
 */

const EMAIL_RE = /[\w.-]+@[\w.-]+\.\w{2,}/g;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

const KNOWN_COMPANIES = [
  'Google', 'Amazon', 'Microsoft', 'Meta', 'Apple', 'Netflix', 'Stripe',
  'Flipkart', 'Uber', 'Ola', 'Swiggy', 'Zomato', 'Razorpay', 'PhonePe',
  'Myntra', 'Paytm', 'CRED', 'Meesho', 'Zerodha', 'Groww', 'Freshworks',
  'Zoho', 'Infosys', 'TCS', 'Wipro', 'HCL', 'Cognizant', 'Accenture',
  'IBM', 'Oracle', 'Adobe', 'Salesforce', 'ServiceNow', 'Atlassian',
  'Databricks', 'Snowflake', 'Confluent', 'HashiCorp', 'Cloudflare',
  'Tesla', 'SpaceX', 'Nvidia', 'AMD', 'Intel', 'Samsung', 'Sony',
  'Twitter', 'LinkedIn', 'Snap', 'Pinterest', 'Reddit', 'Discord',
  'Slack', 'Notion', 'Figma', 'Canva', 'Shopify', 'Twilio', 'Plaid',
  'Roblox', 'Epic Games', 'Riot Games', 'Spotify', 'Airbnb', 'DoorDash',
  'Lyft', 'Instacart', 'Robinhood', 'Coinbase', 'Block', 'Square',
  'Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Deutsche Bank',
  'ByteDance', 'TikTok', 'Agastya', 'Unico', 'Qualcomm',
  'Thermo Fisher', 'Thermo Fisher Scientific', 'Deloitte', 'McKinsey',
  'Boston Consulting Group', 'Bain', 'EY', 'PwC', 'KPMG',
];

const ROLE_PATTERNS = [
  'Software Engineer - I', 'Software Engineer - II', 'Software Engineer 1', 'Software Engineer 2',
  'Software Engineer', 'SDE', 'SDE-1', 'SDE-2', 'SDE-3', 'SDE I', 'SDE II', 'SDE III',
  'Backend Developer', 'Backend Engineer', 'Frontend Developer', 'Frontend Engineer',
  'Full Stack Developer', 'Full Stack Engineer', 'Fullstack Developer', 'Fullstack Engineer',
  'Software Developer', 'Software Trainee', 'Associate Software Engineer',
  'Product Manager', 'Associate Product Manager', 'Technical Program Manager',
  'Data Scientist', 'Data Analyst', 'Data Engineer', 'ML Engineer', 'AI Engineer',
  'DevOps Engineer', 'SRE', 'Site Reliability Engineer', 'Platform Engineer',
  'Mobile Developer', 'Flutter Developer', 'React Native Developer',
  'Android Developer', 'iOS Developer', 'Kotlin Developer', 'Swift Developer',
  'QA Engineer', 'SDET', 'Test Engineer', 'Quality Analyst',
  'UI/UX Designer', 'Product Designer', 'UX Researcher',
  'Cloud Engineer', 'Solutions Architect', 'Technical Architect',
  'Engineering Manager', 'Tech Lead', 'Principal Engineer',
  'Intern', 'Software Engineer Intern', 'Graduate Engineer Trainee', 'GET',
];

export type ParsedJobEntry = {
  company: string;
  role: string;
  email: string;
  applyUrl: string;
  applyUrls: string[];
  description: string;
  sourceUrl: string;
};

function extractAllEmails(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

function extractAllUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  return [...new Set(matches)];
}

/** Check if a URL or its surrounding context is a social promo/resource link rather than an apply link. */
function isJunkOrSocialUrl(url: string, fullText: string): boolean {
  if (/whatsapp|chat\.whatsapp|t\.me\/|telegram|youtube\.com|youtu\.be|instagram\.com|twitter\.com|x\.com/i.test(url)) {
    return true;
  }
  const idx = fullText.indexOf(url);
  if (idx >= 0) {
    const context = fullText.slice(Math.max(0, idx - 60), idx + url.length + 10).toLowerCase();
    if (
      /whatsapp|telegram|interview_kit|resume_defense|prep_kit|sheet|roadmap|follow|repost|subscribe|channel|group/i.test(
        context,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Extract all genuine apply URLs from a block of text. */
function extractApplyUrls(text: string): string[] {
  const urls = extractAllUrls(text);
  const valid: string[] = [];

  for (const url of urls) {
    if (!isJunkOrSocialUrl(url, text)) {
      valid.push(url);
    }
  }
  return valid;
}

/** Match company name from a known list. */
function matchKnownCompany(text: string): string {
  for (const company of KNOWN_COMPANIES) {
    const re = new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) return company;
  }
  return '';
}

/** Extract company name from patterns like "X is hiring" */
function extractCompanyFromPattern(text: string): string {
  const patterns = [
    /([A-Z][A-Za-z0-9&.''\s-]{2,40}?)\s+is\s+(?:hiring|looking for|seeking|recruiting)/i,
    /(?:hiring|opening|position|role|opportunity)\s+at\s+([A-Z][A-Za-z0-9&.''\s-]{2,40})/i,
    /(?:join|work at|team at)\s+([A-Z][A-Za-z0-9&.''\s-]{2,40})/i,
    /@([A-Za-z][A-Za-z0-9._-]{2,30})/,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      let company = match[1]
        .trim()
        .replace(/[.!,;:]+$/, '')
        .replace(/\s+/g, ' ');

      if (/^(we|our|the|a|an|this|i|my|for|it|if|so|to|is|hiring|alert)$/i.test(company)) continue;
      if (company.length < 2 || company.length > 50) continue;

      return company;
    }
  }
  return '';
}

function matchCompany(text: string, email?: string): string {
  const known = matchKnownCompany(text);
  if (known) return known;

  const pattern = extractCompanyFromPattern(text);
  if (pattern) return pattern;

  if (email) {
    const domain = email.split('@')[1];
    if (domain && !/gmail|yahoo|hotmail|outlook|icloud|proton|mail/i.test(domain)) {
      return domain;
    }
  }

  return '';
}

function matchRole(text: string): string {
  for (const role of ROLE_PATTERNS) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(text)) return role;
  }

  const fallbackPatterns = [
    /(?:role|position|opening)\s*:\s*([^.!\n|]{3,50})/i,
    /(?:hiring\s+(?:for|a)\s+)([^.!\n|]{3,50}?)(?:\s*[!.|]|\s+at\s|\s+in\s)/i,
  ];
  for (const re of fallbackPatterns) {
    const match = text.match(re);
    if (match?.[1]) {
      const role = match[1].trim().replace(/[!.]+$/, '');
      if (role.length >= 3 && role.length <= 60) return role;
    }
  }

  return '';
}

/**
 * Parse a single hiring post text into separate structured job entries per company.
 * If a company has multiple apply URLs (e.g. 2 links under Qualcomm), collects ALL links for that job.
 */
export function parseHiringPost(rawText: string, sourceUrl: string): ParsedJobEntry[] {
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (text.length < 20) return [];

  const globalEmails = extractAllEmails(rawText);
  const globalEmail = globalEmails[0] || '';

  // Split post into lines to analyze structure
  const lines = rawText.split(/\n/);

  type Block = {
    company: string;
    role: string;
    text: string;
    urls: string[];
    emails: string[];
  };

  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Ignore social promos & WhatsApp channel join lines
    if (/whatsapp|telegram|repost|follow.*for more|interview_kit|resume_defense/i.test(trimmed)) {
      continue;
    }

    const lineComp = matchCompany(trimmed);
    const lineRole = matchRole(trimmed);
    const lineUrls = extractApplyUrls(trimmed);
    const lineEmails = extractAllEmails(trimmed);

    // If a NEW company is explicitly found on this line, start a new block
    if (lineComp && current && current.company && lineComp.toLowerCase() !== current.company.toLowerCase()) {
      blocks.push(current);
      current = {
        company: lineComp,
        role: lineRole,
        text: trimmed,
        urls: [...lineUrls],
        emails: [...lineEmails],
      };
    } else if (!current) {
      // First block
      current = {
        company: lineComp || matchCompany(rawText, globalEmail) || '',
        role: lineRole,
        text: trimmed,
        urls: [...lineUrls],
        emails: [...lineEmails],
      };
    } else {
      // Same job section: append text & links to current block
      current.text += '\n' + trimmed;
      current.urls.push(...lineUrls);
      current.emails.push(...lineEmails);
      if (!current.company && lineComp) current.company = lineComp;
      if (!current.role && lineRole) current.role = lineRole;
    }
  }

  if (current) {
    blocks.push(current);
  }

  // Deduplicate and build final ParsedJobEntry array
  const results: ParsedJobEntry[] = [];
  const seenCompanies = new Set<string>();

  for (const b of blocks) {
    const company = b.company || matchCompany(b.text, globalEmail) || 'Hiring Company';
    const role = b.role || matchRole(b.text) || 'Open Position';
    const key = `${company.toLowerCase()}|${role.toLowerCase()}`;

    const validUrls = [...new Set(b.urls)];
    const email = b.emails[0] || globalEmail;

    // Skip blocks that have no apply links and no contact email and no role
    if (validUrls.length === 0 && !email && role === 'Open Position') {
      continue;
    }

    if (seenCompanies.has(key)) {
      // Merge apply URLs into existing entry if duplicate company+role
      const existing = results.find((r) => `${r.company.toLowerCase()}|${r.role.toLowerCase()}` === key);
      if (existing) {
        existing.applyUrls = [...new Set([...existing.applyUrls, ...validUrls])];
        if (!existing.applyUrl && validUrls[0]) existing.applyUrl = validUrls[0];
      }
      continue;
    }
    seenCompanies.add(key);

    results.push({
      company,
      role,
      email,
      applyUrl: validUrls[0] || '',
      applyUrls: validUrls,
      description: b.text.slice(0, 2000),
      sourceUrl,
    });
  }

  // Fallback: If no structured blocks returned, try extracting from the whole raw text
  if (results.length === 0) {
    const company = matchCompany(rawText, globalEmail) || 'Hiring Company';
    const role = matchRole(rawText) || 'Open Position';
    const validUrls = extractApplyUrls(rawText);

    if (globalEmails.length > 0 || validUrls.length > 0) {
      results.push({
        company,
        role,
        email: globalEmail,
        applyUrl: validUrls[0] || '',
        applyUrls: validUrls,
        description: rawText.slice(0, 2000),
        sourceUrl,
      });
    }
  }

  return results;
}

export function isHiringText(text: string): boolean {
  const hasKeywords = /hiring|opening|position|role|apply|resume|career|vacancy|opportunity|join.*team|looking for|send.*cv/i.test(text);
  if (!hasKeywords) return false;

  return !!(
    matchCompany(text) ||
    matchRole(text) ||
    EMAIL_RE.test(text) ||
    URL_RE.test(text)
  );
}
