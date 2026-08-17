/**
 * Smart parser for LinkedIn hiring posts.
 * Extracts structured job entries (company, role, email, apply URLs)
 * from free-text posts, including multi-job, multi-link, and Unicode-formatted posts.
 */

const EMAIL_RE = /[\w.-]+@[\w.-]+\.\w{2,}/g;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

const KNOWN_COMPANIES = [
  'Texas Instruments', 'Google', 'Amazon', 'Microsoft', 'Meta', 'Apple', 'Netflix', 'Stripe',
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
  'Software Database Engineer', 'Database Engineer', 'Database Administrator', 'DBA',
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

/**
 * Convert fancy Mathematical Unicode bold/italic/sans-serif/serif characters
 * back to standard ASCII A-Z, a-z, 0-9 characters.
 * E.g., "𝗛𝗶𝗿𝗶𝗻𝗴 — 𝗦𝗼𝗳𝘁𝘄𝗮𝗿𝗲" -> "Hiring — Software"
 */
export function normalizeFancyUnicodeText(input: string): string {
  if (!input) return '';

  let output = '';
  // Use Array.from to correctly iterate over UTF-32 surrogate pairs
  for (const char of Array.from(input)) {
    const code = char.codePointAt(0);
    if (!code) {
      output += char;
      continue;
    }

    // Mathematical Bold (0x1D400 - 0x1D433)
    if (code >= 0x1d400 && code <= 0x1d419) {
      output += String.fromCharCode(65 + (code - 0x1d400));
    } else if (code >= 0x1d41a && code <= 0x1d433) {
      output += String.fromCharCode(97 + (code - 0x1d41a));
    }
    // Mathematical Italic (0x1D434 - 0x1D467)
    else if (code >= 0x1d434 && code <= 0x1d44d) {
      output += String.fromCharCode(65 + (code - 0x1d434));
    } else if (code >= 0x1d44e && code <= 0x1d467) {
      output += String.fromCharCode(97 + (code - 0x1d44e));
    }
    // Mathematical Bold Italic (0x1D468 - 0x1D49B)
    else if (code >= 0x1d468 && code <= 0x1d481) {
      output += String.fromCharCode(65 + (code - 0x1d468));
    } else if (code >= 0x1d482 && code <= 0x1d49b) {
      output += String.fromCharCode(97 + (code - 0x1d482));
    }
    // Mathematical Sans-serif Bold (0x1D5D4 - 0x1D607) -- Matches 𝗛𝗶𝗿𝗶𝗻𝗴!
    else if (code >= 0x1d5d4 && code <= 0x1d5ed) {
      output += String.fromCharCode(65 + (code - 0x1d5d4));
    } else if (code >= 0x1d5ee && code <= 0x1d607) {
      output += String.fromCharCode(97 + (code - 0x1d5ee));
    }
    // Mathematical Sans-serif (0x1D5A0 - 0x1D5D3)
    else if (code >= 0x1d5a0 && code <= 0x1d5b9) {
      output += String.fromCharCode(65 + (code - 0x1d5a0));
    } else if (code >= 0x1d5ba && code <= 0x1d5d3) {
      output += String.fromCharCode(97 + (code - 0x1d5ba));
    }
    // Mathematical Sans-serif Italic (0x1D608 - 0x1D63B)
    else if (code >= 0x1d608 && code <= 0x1d621) {
      output += String.fromCharCode(65 + (code - 0x1d608));
    } else if (code >= 0x1d622 && code <= 0x1d63b) {
      output += String.fromCharCode(97 + (code - 0x1d622));
    }
    // Mathematical Sans-serif Bold Italic (0x1D63C - 0x1D66F)
    else if (code >= 0x1d63c && code <= 0x1d655) {
      output += String.fromCharCode(65 + (code - 0x1d63c));
    } else if (code >= 0x1d656 && code <= 0x1d66f) {
      output += String.fromCharCode(97 + (code - 0x1d656));
    }
    // Mathematical Monospace (0x1D670 - 0x1D6A3)
    else if (code >= 0x1d670 && code <= 0x1d689) {
      output += String.fromCharCode(65 + (code - 0x1d670));
    } else if (code >= 0x1d68a && code <= 0x1d6a3) {
      output += String.fromCharCode(97 + (code - 0x1d68a));
    }
    // Mathematical Digits 0-9 (0x1D7CE - 0x1D7FF)
    else if (code >= 0x1d7ce && code <= 0x1d7d7) {
      output += String.fromCharCode(48 + (code - 0x1d7ce));
    } else if (code >= 0x1d7d8 && code <= 0x1d7e1) {
      output += String.fromCharCode(48 + (code - 0x1d7d8));
    } else if (code >= 0x1d7e2 && code <= 0x1d7eb) {
      output += String.fromCharCode(48 + (code - 0x1d7e2));
    } else if (code >= 0x1d7ec && code <= 0x1d7f5) {
      output += String.fromCharCode(48 + (code - 0x1d7ec));
    } else if (code >= 0x1d7f6 && code <= 0x1d7ff) {
      output += String.fromCharCode(48 + (code - 0x1d7f6));
    } else {
      output += char;
    }
  }

  return output;
}

/** Clean LinkedIn safety redirect URLs (e.g., https://www.linkedin.com/safety/go/?url=https%3A%2F%2Flnkd.in%2F...) */
function cleanUrl(url: string): string {
  if (url.includes('linkedin.com/safety/go/?url=')) {
    try {
      const match = url.match(/url=([^&]+)/);
      if (match?.[1]) {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.startsWith('http')) return decoded;
      }
    } catch {
      // fallback
    }
  }
  return url;
}

function extractAllEmails(text: string): string[] {
  const matches = text.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

function extractAllUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  const cleaned = matches.map(cleanUrl);
  return [...new Set(cleaned)];
}

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

function matchKnownCompany(text: string): string {
  for (const company of KNOWN_COMPANIES) {
    const re = new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) return company;
  }
  return '';
}

function extractCompanyFromPattern(text: string): string {
  const patterns = [
    // Markdown link style: "[Texas Instruments](https://...)"
    /\[([A-Z][A-Za-z0-9&.''\s-]{2,40})\]\(https?:\/\/[^\)]+\)/i,
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
 * Handles fancy Mathematical Unicode characters, Markdown formatting, and LinkedIn safety URLs.
 */
export function parseHiringPost(rawText: string, sourceUrl: string): ParsedJobEntry[] {
  // Normalize fancy Unicode bold/italic characters to standard ASCII first
  const normalizedRaw = normalizeFancyUnicodeText(rawText);
  const text = normalizedRaw.replace(/\s+/g, ' ').trim();
  if (text.length < 20) return [];

  const globalEmails = extractAllEmails(normalizedRaw);
  const globalEmail = globalEmails[0] || '';

  const lines = normalizedRaw.split(/\n/);

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

    if (/whatsapp|telegram|repost|follow.*for more|interview_kit|resume_defense/i.test(trimmed)) {
      continue;
    }

    const lineComp = matchCompany(trimmed);
    const lineRole = matchRole(trimmed);
    const lineUrls = extractApplyUrls(trimmed);
    const lineEmails = extractAllEmails(trimmed);

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
      current = {
        company: lineComp || matchCompany(normalizedRaw, globalEmail) || '',
        role: lineRole,
        text: trimmed,
        urls: [...lineUrls],
        emails: [...lineEmails],
      };
    } else {
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

  const results: ParsedJobEntry[] = [];
  const seenCompanies = new Set<string>();

  for (const b of blocks) {
    const company = b.company || matchCompany(b.text, globalEmail) || 'Hiring Company';
    const role = b.role || matchRole(b.text) || 'Open Position';
    const key = `${company.toLowerCase()}|${role.toLowerCase()}`;

    const validUrls = [...new Set(b.urls)];
    const email = b.emails[0] || globalEmail;

    if (validUrls.length === 0 && !email && role === 'Open Position') {
      continue;
    }

    if (seenCompanies.has(key)) {
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

  if (results.length === 0) {
    const company = matchCompany(normalizedRaw, globalEmail) || 'Hiring Company';
    const role = matchRole(normalizedRaw) || 'Open Position';
    const validUrls = extractApplyUrls(normalizedRaw);

    if (globalEmails.length > 0 || validUrls.length > 0) {
      results.push({
        company,
        role,
        email: globalEmail,
        applyUrl: validUrls[0] || '',
        applyUrls: validUrls,
        description: normalizedRaw.slice(0, 2000),
        sourceUrl,
      });
    }
  }

  return results;
}

export function isHiringText(text: string): boolean {
  const normalized = normalizeFancyUnicodeText(text);
  const hasKeywords = /hiring|opening|position|role|apply|resume|career|vacancy|opportunity|join.*team|looking for|send.*cv/i.test(normalized);
  if (!hasKeywords) return false;

  return !!(
    matchCompany(normalized) ||
    matchRole(normalized) ||
    EMAIL_RE.test(normalized) ||
    URL_RE.test(normalized)
  );
}
