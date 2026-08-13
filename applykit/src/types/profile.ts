export type SkillLevel = 'beginner' | 'intermediate' | 'expert';

export type YesNo = 'Yes' | 'No';

export type Skill = {
  id: string;
  name: string;
  level: SkillLevel;
  keywords: string[];
};

export type Experience = {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string | 'present';
  bullets: string[];
  technologies: string[];
};

export type Education = {
  id: string;
  school: string;
  degree: string;
  year: string;
};

export type EasyApplyDefaults = {
  authorizedToWork: YesNo;
  requiresSponsorship: YesNo;
  yearsOfExperience?: number;
  willingToRelocate: YesNo;
  expectedSalary?: string;
  noticePeriod?: string;
  customAnswers: Record<string, string>;
};

export type PersonalInfo = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  headline: string;
};

export type Profile = {
  version: 1;
  personal: PersonalInfo;
  summary: string;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  easyApplyDefaults: EasyApplyDefaults;
  updatedAt: string;
};

export const PROFILE_STORAGE_KEY = 'applykit_profile';
