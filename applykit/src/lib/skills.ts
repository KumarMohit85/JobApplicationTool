import type { Skill, SkillLevel } from '@/types/profile';
import { createId } from '@/lib/id';

export const SKILL_LEVEL_WEIGHT: Record<SkillLevel, number> = {
  beginner: 1,
  intermediate: 2,
  expert: 3,
};

const VALID_LEVELS = new Set<SkillLevel>(['beginner', 'intermediate', 'expert']);

export function parseKeywordList(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,;|/]+/)) {
    const keyword = part.trim().toLowerCase();
    if (keyword && !seen.has(keyword)) {
      seen.add(keyword);
      result.push(keyword);
    }
  }
  return result;
}

export function formatKeywordList(keywords: string[]): string {
  return keywords.join(', ');
}

export function createEmptySkill(): Skill {
  return {
    id: createId(),
    name: '',
    level: 'intermediate',
    keywords: [],
  };
}

export function normalizeSkill(input: Partial<Skill> | null | undefined): Skill | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    return null;
  }
  const level =
    typeof input.level === 'string' && VALID_LEVELS.has(input.level as SkillLevel)
      ? (input.level as SkillLevel)
      : 'intermediate';
  const keywords = Array.isArray(input.keywords)
    ? parseKeywordList(input.keywords.map(String).join(', '))
    : typeof input.keywords === 'string'
      ? parseKeywordList(input.keywords)
      : [];

  const normalizedName = name.toLowerCase();
  if (!keywords.includes(normalizedName)) {
    keywords.unshift(normalizedName);
  }

  return {
    id: typeof input.id === 'string' && input.id ? input.id : createId(),
    name,
    level,
    keywords,
  };
}

export function normalizeSkills(input: unknown): Skill[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => normalizeSkill(item as Partial<Skill>))
    .filter((skill): skill is Skill => skill != null);
}

/** Collect unique technology strings from experience entries. */
export function suggestSkillsFromTechnologies(technologies: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tech of technologies) {
    const name = tech.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result.sort((a, b) => a.localeCompare(b));
}
