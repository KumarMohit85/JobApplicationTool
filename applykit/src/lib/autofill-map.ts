import type { FieldKey } from '@/lib/autofill-values';

export type FieldPattern = {
  key: FieldKey;
  /** Substrings matched against normalized field hints (label, name, placeholder, etc.). */
  patterns: RegExp[];
  /** HTML autocomplete attribute values. */
  autocomplete?: string[];
};

export const FIELD_PATTERNS: FieldPattern[] = [
  {
    key: 'firstName',
    patterns: [/\bfirst[\s_-]?name\b/i, /\bgiven[\s_-]?name\b/i, /\bfname\b/i],
    autocomplete: ['given-name', 'fname'],
  },
  {
    key: 'lastName',
    patterns: [/\blast[\s_-]?name\b/i, /\bfamily[\s_-]?name\b/i, /\bsurname\b/i, /\blname\b/i],
    autocomplete: ['family-name', 'lname'],
  },
  {
    key: 'fullName',
    patterns: [/\bfull[\s_-]?name\b/i, /\bname\b/i, /\bapplicant[\s_-]?name\b/i],
    autocomplete: ['name'],
  },
  {
    key: 'email',
    patterns: [/\be[\s-]?mail\b/i, /\bemail[\s_-]?address\b/i],
    autocomplete: ['email'],
  },
  {
    key: 'phone',
    patterns: [/\bphone\b/i, /\bmobile\b/i, /\btel\b/i, /\bcell\b/i, /\bcontact[\s_-]?number\b/i],
    autocomplete: ['tel', 'tel-national', 'tel-local'],
  },
  {
    key: 'location',
    patterns: [
      /\blocation\b/i,
      /\bcity\b/i,
      /\baddress\b/i,
      /\bwhere[\s_-]?do[\s_-]?you[\s_-]?live\b/i,
      /\bcurrent[\s_-]?location\b/i,
    ],
    autocomplete: ['address-level2', 'street-address', 'address-line1'],
  },
  {
    key: 'linkedIn',
    patterns: [/\blinkedin\b/i, /\blinked[\s_-]?in[\s_-]?url\b/i, /\blinked[\s_-]?in[\s_-]?profile\b/i],
    autocomplete: ['url'],
  },
  {
    key: 'github',
    patterns: [/\bgithub\b/i, /\bgithub[\s_-]?url\b/i, /\bgithub[\s_-]?profile\b/i],
  },
  {
    key: 'portfolio',
    patterns: [/\bportfolio\b/i, /\bpersonal[\s_-]?website\b/i, /\bwebsite[\s_-]?url\b/i],
    autocomplete: ['url'],
  },
  {
    key: 'website',
    patterns: [/\bwebsite\b/i, /\bweb[\s_-]?site\b/i, /\burl\b/i, /\bhomepage\b/i],
    autocomplete: ['url'],
  },
  {
    key: 'headline',
    patterns: [/\bheadline\b/i, /\bprofessional[\s_-]?title\b/i],
  },
  {
    key: 'coverLetter',
    patterns: [
      /\bcover[\s_-]?letter\b/i,
      /\badditional[\s_-]?information\b/i,
      /\bwhy[\s_-]?are[\s_-]?you[\s_-]?interested\b/i,
      /\bmessage[\s_-]?to[\s_-]?hiring\b/i,
      /\bcomments\b/i,
      /\bnotes\b/i,
    ],
  },
  {
    key: 'authorizedToWork',
    patterns: [
      /\bauthorized[\s_-]?to[\s_-]?work\b/i,
      /\blegally[\s_-]?authorized\b/i,
      /\beligible[\s_-]?to[\s_-]?work\b/i,
      /\bwork[\s_-]?authorization\b/i,
      /\bwork[\s_-]?permit\b/i,
    ],
  },
  {
    key: 'requiresSponsorship',
    patterns: [
      /\bsponsorship\b/i,
      /\bvisa[\s_-]?sponsorship\b/i,
      /\brequire[\s_-]?sponsorship\b/i,
      /\bneed[\s_-]?sponsorship\b/i,
    ],
  },
  {
    key: 'willingToRelocate',
    patterns: [/\bwilling[\s_-]?to[\s_-]?relocate\b/i, /\brelocate\b/i, /\brelocation\b/i],
  },
  {
    key: 'yearsOfExperience',
    patterns: [
      /\byears[\s_-]?of[\s_-]?experience\b/i,
      /\btotal[\s_-]?experience\b/i,
      /\bexperience[\s_-]?years\b/i,
    ],
  },
  {
    key: 'noticePeriod',
    patterns: [/\bnotice[\s_-]?period\b/i, /\bstart[\s_-]?date\b/i, /\bavailability\b/i],
  },
  {
    key: 'expectedSalary',
    patterns: [
      /\bsalary\b/i,
      /\bcompensation\b/i,
      /\bexpected[\s_-]?salary\b/i,
      /\bdesired[\s_-]?salary\b/i,
      /\bpay[\s_-]?expectation\b/i,
    ],
  },
];
