import type { JobContext } from '@/types/job';
import type { GeneratedContent } from '@/types/generated';
import type { Profile } from '@/types/profile';
import { normalizeJobText } from '@/lib/matcher';

export type GenerateInput = {
  profile: Profile;
  job: JobContext;
  matchedSkillNames: string[];
  resumeName?: string;
  driveUrl?: string;
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '');
}

function contactLine(profile: Profile): string {
  const parts = [profile.personal.phone, profile.personal.linkedIn].filter(Boolean);
  return parts.join(' | ');
}

function buildTopSkillsPhrase(names: string[], max = 4): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return 'relevant technologies';
  if (unique.length <= max) return unique.join(', ');
  return `${unique.slice(0, max).join(', ')}, and more`;
}

function recentExperienceHighlight(profile: Profile): string {
  const latest = profile.experience[0];
  if (!latest) return '';
  const bullet = latest.bullets.find((b) => b.trim());
  if (bullet) return bullet.trim();
  if (latest.title && latest.company) {
    return `Most recently, I worked as ${latest.title} at ${latest.company}.`;
  }
  return '';
}

function buildFitParagraph(input: GenerateInput): string {
  const { profile, job, matchedSkillNames } = input;
  const skillsPhrase = buildTopSkillsPhrase(matchedSkillNames);
  const parts: string[] = [];

  if (matchedSkillNames.length > 0) {
    parts.push(
      `My background in ${skillsPhrase} aligns well with the ${job.title || 'role'}${job.company ? ` at ${job.company}` : ''}.`,
    );
  }

  if (profile.summary.trim()) {
    parts.push(profile.summary.trim());
  } else {
    const highlight = recentExperienceHighlight(profile);
    if (highlight) parts.push(highlight);
  }

  return parts.join(' ').trim();
}

function buildCoverLetter(input: GenerateInput, fitParagraph: string): string {
  const { profile, job } = input;
  const role = job.title || 'the open position';
  const company = job.company || 'your company';
  const vars = {
    role,
    company,
    yourName: profile.personal.fullName || 'Applicant',
    fitParagraph,
    headline: profile.personal.headline,
    linkedIn: profile.personal.linkedIn,
    phone: profile.personal.phone,
    topMatchedSkills: buildTopSkillsPhrase(input.matchedSkillNames),
  };

  const template = `Dear Hiring Team,

I am writing to express my interest in the {{role}} position at {{company}}.

{{fitParagraph}}

I would welcome the opportunity to contribute to your team and discuss how my experience can support your goals.

Best regards,
{{yourName}}
{{phone}} | {{linkedIn}}`;

  return fillTemplate(template, {
    ...vars,
    phone: vars.phone || '',
    linkedIn: vars.linkedIn || '',
  })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildColdEmail(input: GenerateInput, fitParagraph: string): GeneratedContent['coldEmail'] {
  const { profile, job, resumeName, driveUrl } = input;
  const role = job.title || 'the open position';
  const company = job.company || 'your company';
  const yourName = profile.personal.fullName || 'Applicant';

  const subject = `Application for ${role}${company ? ` — ${company}` : ''} — ${yourName}`;

  let resumeLine = driveUrl?.trim()
    ? `You can view my resume online at: ${driveUrl.trim()}`
    : resumeName
      ? `Please find my resume (${resumeName}) attached for your review.`
      : 'Please find my resume attached for your review.';

  const bodyTemplate = `Dear Hiring Team,

I am writing to apply for the {{role}} position at {{company}}. I believe my background in {{topMatchedSkills}} aligns with what you are looking for.

{{fitParagraph}}

${resumeLine} I would welcome a conversation about how I can contribute to your team.

Best regards,
{{yourName}}
{{contactLine}}`;

  const body = fillTemplate(bodyTemplate, {
    role,
    company,
    topMatchedSkills: buildTopSkillsPhrase(input.matchedSkillNames),
    fitParagraph,
    yourName,
    contactLine: contactLine(profile),
  }).trim();

  return { subject, body };
}

/** Build fit paragraph, cover letter, and cold email from profile + job context. */
export function generateContent(input: GenerateInput): GeneratedContent {
  const fitParagraph = buildFitParagraph(input);
  return {
    fitParagraph,
    coverLetter: buildCoverLetter(input, fitParagraph),
    coldEmail: buildColdEmail(input, fitParagraph),
  };
}

/** True when there is enough job text to generate meaningful copy. */
export function canGenerateContent(job: JobContext | null): boolean {
  if (!job) return false;
  return Boolean(
    normalizeJobText(job.description).length > 20 ||
      job.title.trim() ||
      job.company.trim(),
  );
}
