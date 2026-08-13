import type { Profile } from '@/types/profile';
import { resolveYearsOfExperience } from '@/lib/profile';

export type FieldKey =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'location'
  | 'linkedIn'
  | 'github'
  | 'portfolio'
  | 'website'
  | 'headline'
  | 'authorizedToWork'
  | 'requiresSponsorship'
  | 'willingToRelocate'
  | 'yearsOfExperience'
  | 'noticePeriod'
  | 'expectedSalary'
  | 'coverLetter';

export type AutofillValueMap = Partial<Record<FieldKey, string>>;

export function buildAutofillValues(
  profile: Profile,
  extras?: { coverLetter?: string },
): AutofillValueMap {
  const years = resolveYearsOfExperience(profile);
  const website = profile.personal.portfolio || profile.personal.github;

  return {
    firstName: profile.personal.firstName,
    lastName: profile.personal.lastName,
    fullName: profile.personal.fullName,
    email: profile.personal.email,
    phone: profile.personal.phone,
    location: profile.personal.location,
    linkedIn: profile.personal.linkedIn,
    github: profile.personal.github,
    portfolio: profile.personal.portfolio,
    website,
    headline: profile.personal.headline,
    authorizedToWork: profile.easyApplyDefaults.authorizedToWork,
    requiresSponsorship: profile.easyApplyDefaults.requiresSponsorship,
    willingToRelocate: profile.easyApplyDefaults.willingToRelocate,
    yearsOfExperience: years != null ? String(years) : undefined,
    noticePeriod: profile.easyApplyDefaults.noticePeriod,
    expectedSalary: profile.easyApplyDefaults.expectedSalary,
    coverLetter: extras?.coverLetter,
  };
}
