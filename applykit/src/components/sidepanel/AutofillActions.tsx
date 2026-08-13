import { useEffect, useMemo, useState } from 'react';
import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import {
  buildResumeFilePayload,
  formatAutofillMessage,
  runAutofillOnActiveTab,
} from '@/lib/autofill-client';
import { canGenerateContent, generateContent } from '@/lib/generator';
import { matchResume, matchSkills } from '@/lib/matcher';
import { listResumes } from '@/lib/resumes';
import { Button, StatusBanner } from '@/components/ui';

type AutofillActionsProps = {
  context: JobContext | null;
  profile: Profile;
  coverLetter?: string;
};

export function AutofillActions({ context, profile, coverLetter }: AutofillActionsProps) {
  const [resumes, setResumes] = useState<ResumeVariant[]>([]);
  const [loading, setLoading] = useState<'easy_apply' | 'form' | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  );
  const [forceFill, setForceFill] = useState(false);

  useEffect(() => {
    void listResumes().then(setResumes);
  }, []);

  const resumeMatch = useMemo(() => {
    if (!context?.description || resumes.length === 0) return null;
    return matchResume(resumes, context.description, context.title);
  }, [context, resumes]);

  const resolvedCoverLetter = useMemo(() => {
    if (coverLetter?.trim()) return coverLetter;
    if (!context || !canGenerateContent(context)) return undefined;
    const skillMatch = matchSkills(profile.skills, context.description);
    const matchedSkillNames = skillMatch.matched.map((m) => m.skill.name);
    const generated = generateContent({
      profile,
      job: context,
      matchedSkillNames,
      resumeName: resumeMatch?.resume.name,
    });
    return generated.coverLetter;
  }, [coverLetter, context, profile, resumeMatch]);

  const runAutofill = async (mode: 'easy_apply' | 'form') => {
    setLoading(mode);
    setFeedback(null);

    const resumeFile = await buildResumeFilePayload(resumeMatch?.resume);
    const { result, error } = await runAutofillOnActiveTab({
      mode,
      forceFill,
      coverLetter: resolvedCoverLetter,
      resumeFile,
    });

    setLoading(null);
    const message = formatAutofillMessage(result, error);
    const tone =
      error || result.errors.length > 0
        ? 'error'
        : result.filledCount > 0
          ? 'success'
          : 'info';
    setFeedback({ message, tone });
  };

  const isLinkedIn =
    context?.source === 'linkedin' || Boolean(context?.url?.includes('linkedin.com'));

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Autofill</h2>
        <p className="text-xs text-slate-500">
          Fills empty fields only. You click Next and Submit on the form.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={isLinkedIn ? 'primary' : 'secondary'}
          disabled={loading != null}
          onClick={() => void runAutofill('easy_apply')}
        >
          {loading === 'easy_apply' ? 'Filling…' : 'Fill Easy Apply'}
        </Button>
        <Button
          variant={isLinkedIn ? 'secondary' : 'primary'}
          disabled={loading != null}
          onClick={() => void runAutofill('form')}
        >
          {loading === 'form' ? 'Filling…' : 'Fill form on page'}
        </Button>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={forceFill}
          onChange={(e) => setForceFill(e.target.checked)}
          className="rounded border-slate-300"
        />
        Force fill (overwrite existing values)
      </label>

      {feedback ? <StatusBanner message={feedback.message} tone={feedback.tone} /> : null}
    </div>
  );
}
