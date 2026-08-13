import {
  PROFILE_STORAGE_KEY,
  type EasyApplyDefaults,
  type PersonalInfo,
  type Profile,
} from '@/types/profile';
import { createId } from '@/lib/id';

export function createDefaultPersonalInfo(): PersonalInfo {
  return {
    fullName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    linkedIn: '',
    github: '',
    portfolio: '',
    headline: '',
  };
}

export function createDefaultEasyApplyDefaults(): EasyApplyDefaults {
  return {
    authorizedToWork: 'Yes',
    requiresSponsorship: 'No',
    willingToRelocate: 'Yes',
    expectedSalary: '',
    noticePeriod: 'Immediate',
    customAnswers: {},
  };
}

export function createDefaultProfile(): Profile {
  return {
    version: 1,
    personal: createDefaultPersonalInfo(),
    summary: '',
    skills: [],
    experience: [],
    education: [],
    easyApplyDefaults: createDefaultEasyApplyDefaults(),
    updatedAt: new Date().toISOString(),
  };
}

function mergePersonal(partial: Partial<PersonalInfo>, base: PersonalInfo): PersonalInfo {
  const merged = { ...base, ...partial };
  if (partial.fullName !== undefined || partial.firstName === undefined) {
    const parts = merged.fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && !merged.firstName && !merged.lastName) {
      merged.firstName = parts[0] ?? '';
      merged.lastName = parts.slice(1).join(' ');
    }
  }
  if (merged.firstName || merged.lastName) {
    merged.fullName = [merged.firstName, merged.lastName].filter(Boolean).join(' ').trim();
  }
  return merged;
}

export function normalizeProfile(input: Partial<Profile> | null | undefined): Profile {
  const base = createDefaultProfile();
  if (!input || typeof input !== 'object') {
    return base;
  }

  return {
    version: 1,
    personal: mergePersonal(input.personal ?? {}, base.personal),
    summary: typeof input.summary === 'string' ? input.summary : base.summary,
    skills: Array.isArray(input.skills) ? input.skills : base.skills,
    experience: Array.isArray(input.experience) ? input.experience : base.experience,
    education: Array.isArray(input.education) ? input.education : base.education,
    easyApplyDefaults: {
      ...base.easyApplyDefaults,
      ...(input.easyApplyDefaults ?? {}),
      customAnswers: {
        ...base.easyApplyDefaults.customAnswers,
        ...(input.easyApplyDefaults?.customAnswers ?? {}),
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function getProfile(): Promise<Profile> {
  const result = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
  const stored = result[PROFILE_STORAGE_KEY] as Partial<Profile> | undefined;
  return normalizeProfile(stored);
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const normalized = normalizeProfile({
    ...profile,
    updatedAt: new Date().toISOString(),
  });
  await chrome.storage.local.set({ [PROFILE_STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearProfile(): Promise<void> {
  await chrome.storage.local.remove(PROFILE_STORAGE_KEY);
}

export function exportProfileJson(profile: Profile): string {
  return JSON.stringify(profile, null, 2);
}

export function importProfileJson(json: string): Profile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON file.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Profile file must be a JSON object.');
  }
  return normalizeProfile(parsed as Partial<Profile>);
}

export function downloadJson(filename: string, data: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Years of experience from work history, or manual override. */
export function resolveYearsOfExperience(profile: Profile): number | undefined {
  if (profile.easyApplyDefaults.yearsOfExperience != null) {
    return profile.easyApplyDefaults.yearsOfExperience;
  }
  if (profile.experience.length === 0) {
    return undefined;
  }

  const starts = profile.experience
    .map((exp) => new Date(exp.startDate))
    .filter((d) => !Number.isNaN(d.getTime()));

  if (starts.length === 0) {
    return undefined;
  }

  const earliest = starts.reduce((min, d) => (d < min ? d : min));
  const years = (Date.now() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(years * 10) / 10);
}

export { createId };
