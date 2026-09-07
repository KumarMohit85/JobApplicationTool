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
  | 'coverLetter'
  | 'workCountry'
  | 'earliestStartDate'
  | 'workArrangement'
  | 'howHeard'
  | 'knowAnyoneAtCompany'
  | 'visaType'
  | 'currentCompany'
  | 'currentTitle'
  | 'eeoGender'
  | 'eeoRace'
  | 'eeoVeteran'
  | 'eeoDisability';

export type AutofillValueMap = Partial<Record<FieldKey, string>>;

export function buildAutofillValues(
  profile: Profile,
  extras?: { coverLetter?: string },
): AutofillValueMap {
  const years = resolveYearsOfExperience(profile);
  const website = profile.personal.portfolio || profile.personal.github;
  const latest = profile.experience[0];
  const d = profile.easyApplyDefaults;

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
    authorizedToWork: d.authorizedToWork,
    requiresSponsorship: d.requiresSponsorship,
    willingToRelocate: d.willingToRelocate,
    yearsOfExperience: years != null ? String(years) : undefined,
    noticePeriod: d.noticePeriod,
    expectedSalary: d.expectedSalary,
    coverLetter: extras?.coverLetter,
    workCountry: d.workCountry,
    earliestStartDate: d.earliestStartDate,
    workArrangement: d.workArrangement,
    howHeard: d.howHeard,
    knowAnyoneAtCompany: d.knowAnyoneAtCompany,
    visaType: d.visaType,
    currentCompany: d.currentCompany || latest?.company,
    currentTitle: d.currentTitle || latest?.title,
    eeoGender: d.eeoGender,
    eeoRace: d.eeoRace,
    eeoVeteran: d.eeoVeteran,
    eeoDisability: d.eeoDisability,
  };
}
