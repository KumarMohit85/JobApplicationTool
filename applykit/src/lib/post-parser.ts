/**
 * Smart parser for LinkedIn hiring posts.
 * Extracts structured job entries (company, role, email, apply URL)
 * from free-text posts, including multi-job posts.
 */

const EMAIL_RE = /[\w.-]+@[\w.-]+\.\w{2,}/g;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

// Known company names to match in text
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
  'ByteDance', 'TikTok', 'Agastya', 'Unico',
  'Thermo Fisher', 'Thermo Fisher Scientific', 'Deloitte', 'McKinsey',
  'Boston Consulting Group', 'Bain', 'EY', 'PwC', 'KPMG',
];

const ROLE_PATTERNS = [
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
  description: string;
  sourceUrl: string;
};

function extractAllEmails(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

function extractAllUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  // Filter out social sharing / non-apply URLs
  return matches.filter(
    (u) =>
      !/whatsapp|t\.me\/|telegram|youtube|instagram|twitter\.com|x\.com/i.test(u),
  );
}

function findApplyUrls(text: string): string[] {
  const allUrls = extractAllUrls(text);
  const applyUrls: string[] = [];
  const otherUrls: string[] = [];

  for (const url of allUrls) {
    const idx = text.indexOf(url);
    const context = text.slice(Math.max(0, idx - 80), idx + url.length + 20).toLowerCase();
    if (/apply|form|career|job|opening|hiring|position|register|here/i.test(context)) {
      applyUrls.push(url);
    } else {
      otherUrls.push(url);
    }
  }

  return applyUrls.length > 0 ? applyUrls : otherUrls;
}

/** Match company name from a known list. */
function matchKnownCompany(text: string): string {
  for (const company of KNOWN_COMPANIES) {
    const re = new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) return company;
  }
  return '';
}

/**
 * Extract company name from patterns like:
 *   "X is hiring"
 *   "X is looking for"
 *   "Join X"
 *   "at X"
 *   "hiring at X"
 * This handles companies NOT in the known list.
 */
function extractCompanyFromPattern(text: string): string {
  const patterns = [
    // "Thermo Fisher Scientific is hiring for..."
    /([A-Z][A-Za-z0-9&.''\s-]{2,40}?)\s+is\s+(?:hiring|looking for|seeking|recruiting)/i,
    // "hiring at Thermo Fisher Scientific"
    /(?:hiring|opening|position|role|opportunity)\s+at\s+([A-Z][A-Za-z0-9&.''\s-]{2,40})/i,
    // "Join Thermo Fisher" or "Join our team at X"
    /(?:join|work at|team at)\s+([A-Z][A-Za-z0-9&.''\s-]{2,40})/i,
    // "@CompanyName" (LinkedIn mention style)
    /@([A-Za-z][A-Za-z0-9._-]{2,30})/,
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      let company = match[1].trim()
        .replace(/[.!,;:]+$/, '')  // Remove trailing punctuation
        .replace(/\s+/g, ' ');     // Normalize spaces

      // Filter out common false positives
      if (/^(we|our|the|a|an|this|i|my|for|it|if|so|to|is)$/i.test(company)) continue;
      if (company.length < 2 || company.length > 50) continue;

      return company;
    }
  }
  return '';
}

/** Try all methods to find company name. */
function matchCompany(text: string, email?: string): string {
  // 1. Known company list (fastest, most accurate)
  const known = matchKnownCompany(text);
  if (known) return known;

  // 2. Pattern-based extraction from text
  const pattern = extractCompanyFromPattern(text);
  if (pattern) return pattern;

  // 3. Email domain fallback (e.g., "prachi@agasty.ai" → "agasty.ai")
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

  // Fallback: "hiring for X" / "role: X"
  const fallbackPatterns = [
    /(?:hiring\s+(?:for|a)\s+)([^.!\n|]{3,50}?)(?:\s*[!.|]|\s+at\s|\s+in\s)/i,
    /(?:role|position|opening)\s*:\s*([^.!\n|]{3,50})/i,
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
 * Parse a single hiring post text into one or more structured job entries.
 * Handles multi-job posts like "Stripe is hiring... Flipkart is hiring..."
 */
export function parseHiringPost(
  rawText: string,
  sourceUrl: string,
): ParsedJobEntry[] {
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (text.length < 20) return [];

  const globalEmails = extractAllEmails(text);
  const globalApplyUrls = findApplyUrls(text);
  const globalEmail = globalEmails[0] || '';

  // Try to split into individual job blocks by line
  const lines = rawText.split(/\n/);
  const jobBlocks: { text: string; company: string; role: string; urls: string[]; emails: string[] }[] = [];

  let currentBlock: typeof jobBlocks[0] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    const lineCompany = matchCompany(trimmed);
    const lineRole = matchRole(trimmed);
    const lineEmails = extractAllEmails(trimmed);
    const lineUrls = extractAllUrls(trimmed);

    // Start a new block if we detect a company or role name
    if (lineCompany || lineRole) {
      if (currentBlock && (currentBlock.company || currentBlock.role)) {
        jobBlocks.push(currentBlock);
      }
      currentBlock = {
        text: trimmed,
        company: lineCompany,
        role: lineRole,
        urls: lineUrls,
        emails: lineEmails,
      };
    } else if (currentBlock) {
      // Append to current block
      currentBlock.text += ' ' + trimmed;
      currentBlock.urls.push(...lineUrls);
      currentBlock.emails.push(...lineEmails);
      if (!currentBlock.role) currentBlock.role = matchRole(trimmed);
    }
  }

  // Push the last block
  if (currentBlock && (currentBlock.company || currentBlock.role)) {
    jobBlocks.push(currentBlock);
  }

  // If no blocks were found, try the whole text as a single job
  if (jobBlocks.length === 0) {
    const company = matchCompany(text, globalEmail);
    const role = matchRole(text);

    // Even without a company/role match, if we have an email or apply URL, create an entry
    if (!company && !role && globalEmails.length === 0 && globalApplyUrls.length === 0) {
      return [];
    }

    return [{
      company: company || 'Hiring Company',
      role: role || 'Open Position',
      email: globalEmail,
      applyUrl: globalApplyUrls[0] || '',
      description: text.slice(0, 2000),
      sourceUrl,
    }];
  }

  // Deduplicate and build final entries
  const seen = new Set<string>();
  const results: ParsedJobEntry[] = [];

  for (const block of jobBlocks) {
    const company = block.company || matchCompany(text, globalEmail) || 'Hiring Company';
    const role = block.role || 'Open Position';
    const key = `${company.toLowerCase()}|${role.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Find the best apply URL for this block
    const blockApplyUrls = findApplyUrls(block.text);
    const applyUrl = blockApplyUrls[0] || block.urls[0] || '';
    const email = block.emails[0] || globalEmail;

    results.push({
      company,
      role,
      email,
      applyUrl,
      description: block.text.slice(0, 2000),
      sourceUrl,
    });
  }

  // If parsing produced no results, create a single entry with whatever we have
  if (results.length === 0) {
    const company = matchCompany(text, globalEmail) || 'Hiring Company';
    const role = matchRole(text) || 'Open Position';

    if (globalEmails.length > 0 || globalApplyUrls.length > 0) {
      results.push({
        company,
        role,
        email: globalEmail,
        applyUrl: globalApplyUrls[0] || '',
        description: text.slice(0, 2000),
        sourceUrl,
      });
    }
  }

  return results;
}

/**
 * Convenience: is this text likely a hiring post?
 */
export function isHiringText(text: string): boolean {
  const hasKeywords = /hiring|opening|position|role|apply|resume|career|vacancy|opportunity|join.*team|looking for|send.*cv/i.test(text);
  if (!hasKeywords) return false;

  // Must have at least one of: company, role, email, or URL
  return !!(
    matchCompany(text) ||
    matchRole(text) ||
    EMAIL_RE.test(text) ||
    URL_RE.test(text)
  );
}
