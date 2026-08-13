import { useEffect, useMemo, useState } from 'react';
import type { JobContext } from '@/types/job';
import type { GeneratedContent } from '@/types/generated';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import { canGenerateContent, generateContent } from '@/lib/generator';
import { matchResume, matchSkills } from '@/lib/matcher';
import { listResumes } from '@/lib/resumes';

export function useSidePanelMatch(context: JobContext | null, profile: Profile) {
  const [resumes, setResumes] = useState<ResumeVariant[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');

  useEffect(() => {
    void listResumes().then(setResumes);
  }, []);

  const skillMatch = useMemo(() => {
    if (!context?.description || profile.skills.length === 0) return null;
    return matchSkills(profile.skills, context.description);
  }, [context?.description, profile.skills]);

  const resumeMatch = useMemo(() => {
    if (!context?.description || resumes.length === 0) return null;
    return matchResume(resumes, context.description, context.title);
  }, [context, resumes]);

  useEffect(() => {
    if (resumeMatch?.resume.id) {
      setSelectedResumeId(resumeMatch.resume.id);
    } else if (resumes[0]?.id) {
      setSelectedResumeId(resumes[0].id);
    } else {
      setSelectedResumeId('');
    }
  }, [resumeMatch?.resume.id, resumes]);

  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === selectedResumeId) ?? resumeMatch?.resume ?? null,
    [resumes, selectedResumeId, resumeMatch],
  );

  const generated = useMemo((): GeneratedContent | null => {
    if (!context || !canGenerateContent(context)) return null;
    const matchedSkillNames = skillMatch?.matched.map((m) => m.skill.name) ?? [];
    return generateContent({
      profile,
      job: context,
      matchedSkillNames,
      resumeName: selectedResume?.name,
    });
  }, [context, profile, skillMatch, selectedResume]);

  return {
    resumes,
    selectedResumeId,
    setSelectedResumeId,
    selectedResume,
    skillMatch,
    resumeMatch,
    generated,
  };
}
