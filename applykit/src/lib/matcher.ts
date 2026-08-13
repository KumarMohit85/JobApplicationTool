import type { Skill } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import { SKILL_LEVEL_WEIGHT } from '@/lib/skills';

export type SkillMatchResult = {
  matched: { skill: Skill; weight: number }[];
  missing: string[];
  score: number;
};

export type ResumeMatchResult = {
  resume: ResumeVariant;
  score: number;
  confidence: number;
};

function tokenize(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);
  return new Set(tokens);
}

export function normalizeJobText(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function textIncludes(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return false;
  return h.includes(n);
}

/** Score profile skills against a job description (MVP — local keyword overlap). */
export function matchSkills(skills: Skill[], jobDescription: string): SkillMatchResult {
  const jd = normalizeJobText(jobDescription);
  if (!jd || skills.length === 0) {
    return { matched: [], missing: skills.map((s) => s.name), score: 0 };
  }

  const matched: SkillMatchResult['matched'] = [];
  const missing: string[] = [];

  for (const skill of skills) {
    const terms = [skill.name, ...skill.keywords];
    const hit = terms.some((term) => textIncludes(jd, term));
    if (hit) {
      matched.push({ skill, weight: SKILL_LEVEL_WEIGHT[skill.level] });
    } else {
      missing.push(skill.name);
    }
  }

  matched.sort((a, b) => b.weight - a.weight || a.skill.name.localeCompare(b.skill.name));

  const maxPossible = skills.reduce((sum, s) => sum + SKILL_LEVEL_WEIGHT[s.level], 0);
  const score =
    maxPossible > 0
      ? Math.round((matched.reduce((sum, m) => sum + m.weight, 0) / maxPossible) * 100)
      : 0;

  return { matched, missing, score };
}

function roleSimilarity(targetRoles: string[], role: string): number {
  if (!role.trim() || targetRoles.length === 0) return 0;
  const r = role.toLowerCase();
  let best = 0;
  for (const target of targetRoles) {
    const t = target.toLowerCase().trim();
    if (!t) continue;
    if (r.includes(t) || t.includes(r)) {
      best = Math.max(best, 2);
    } else {
      const rTokens = tokenize(r);
      const tTokens = tokenize(t);
      let overlap = 0;
      for (const tok of tTokens) {
        if (rTokens.has(tok)) overlap++;
      }
      if (overlap > 0) best = Math.max(best, 1);
    }
  }
  return best;
}

function countKeywordHits(keywords: Iterable<string>, jd: string): number {
  let hits = 0;
  for (const kw of keywords) {
    if (textIncludes(jd, kw)) hits++;
  }
  return hits;
}

function scoreResume(resume: ResumeVariant, jobDescription: string, role: string): number {
  const jd = normalizeJobText(jobDescription);
  if (!jd) return 0;

  const skillHits = countKeywordHits(resume.skills, jd);
  const keywordHits = countKeywordHits(resume.keywords, jd);
  const roleScore = roleSimilarity(resume.targetRoles, role);
  const descOverlap = countKeywordHits(tokenize(resume.description), jd);

  return (
    skillHits * 3 + keywordHits * 2 + roleScore * 2 + Math.min(descOverlap, 5) + resume.priority * 0.1
  );
}

/** Pick the best resume variant for a job description (MVP). */
export function matchResume(
  resumes: ResumeVariant[],
  jobDescription: string,
  role = '',
): ResumeMatchResult | null {
  if (resumes.length === 0) return null;

  const scored = resumes
    .map((resume) => ({
      resume,
      score: scoreResume(resume, jobDescription, role),
    }))
    .sort((a, b) => b.score - a.score || a.resume.name.localeCompare(b.resume.name));

  const best = scored[0];
  if (!best) return null;

  const maxScore = scored.reduce((max, item) => Math.max(max, item.score), 0) || 1;
  const confidence = best.score > 0 ? Math.min(100, Math.round((best.score / maxScore) * 100)) : 0;

  return { resume: best.resume, score: best.score, confidence };
}

/** Rank all resumes for the test-match UI. */
export function rankResumes(
  resumes: ResumeVariant[],
  jobDescription: string,
  role = '',
): ResumeMatchResult[] {
  if (resumes.length === 0) return [];

  const maxScore =
    Math.max(...resumes.map((r) => scoreResume(r, jobDescription, role)), 0) || 1;

  return resumes
    .map((resume) => {
      const score = scoreResume(resume, jobDescription, role);
      const confidence = score > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
      return { resume, score, confidence };
    })
    .sort((a, b) => b.score - a.score || a.resume.name.localeCompare(b.resume.name));
}
