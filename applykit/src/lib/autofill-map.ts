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
    patterns: [/\bnotice[\s_-]?period\b/i, /\bavailability\b/i],
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
  {
    key: 'workCountry',
    patterns: [/\bcountry\b/i, /\bcitizenship\b/i, /\bnationality\b/i],
  },
  {
    key: 'earliestStartDate',
    patterns: [/\bearliest[\s_-]?start\b/i, /\bavailable[\s_-]?to[\s_-]?start\b/i, /\bstart[\s_-]?date\b/i],
  },
  {
    key: 'workArrangement',
    patterns: [/\bremote\b/i, /\bhybrid\b/i, /\bonsite\b/i, /\bon[\s_-]?site\b/i, /\bwork[\s_-]?arrangement\b/i],
  },
  {
    key: 'howHeard',
    patterns: [/\bhow[\s_-]?did[\s_-]?you[\s_-]?hear\b/i, /\bhow[\s_-]?did[\s_-]?you[\s_-]?find\b/i],
  },
  {
    key: 'knowAnyoneAtCompany',
    patterns: [/\bknow[\s_-]?anyone\b/i, /\breferral[\s_-]?employee\b/i, /\bemployee[\s_-]?referral\b/i],
  },
  {
    key: 'visaType',
    patterns: [/\bvisa[\s_-]?type\b/i, /\bvisa[\s_-]?status\b/i, /\bimmigration[\s_-]?status\b/i],
  },
  {
    key: 'currentCompany',
    patterns: [/\bcurrent[\s_-]?company\b/i, /\bcurrent[\s_-]?employer\b/i, /\bmost[\s_-]?recent[\s_-]?employer\b/i],
  },
  {
    key: 'currentTitle',
    patterns: [/\bcurrent[\s_-]?title\b/i, /\bcurrent[\s_-]?role\b/i, /\bcurrent[\s_-]?position\b/i],
  },
  {
    key: 'eeoGender',
    patterns: [/\bgender\b/i, /\bsex\b/i],
  },
  {
    key: 'eeoRace',
    patterns: [/\brace\b/i, /\bethnicity\b/i, /\bethnic[\s_-]?group\b/i],
  },
  {
    key: 'eeoVeteran',
    patterns: [/\bveteran\b/i],
  },
  {
    key: 'eeoDisability',
    patterns: [/\bdisability\b/i, /\bdisabled\b/i],
  },
];
