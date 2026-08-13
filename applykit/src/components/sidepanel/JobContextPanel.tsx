import { useEffect, useMemo, useState } from 'react';
import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import { matchResume, matchSkills } from '@/lib/matcher';
import { listResumes } from '@/lib/resumes';
import { Button, StatusBanner } from '@/components/ui';

type JobContextPanelProps = {
  context: JobContext | null;
  loading: boolean;
  error: string | null;
  profile: Profile;
  onRefresh: () => Promise<void>;
  onAppendSelection: () => Promise<boolean>;
};

const SOURCE_LABELS: Record<JobContext['source'], string> = {
  linkedin: 'LinkedIn',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  generic: 'Generic',
  manual: 'Manual selection',
};

export function JobContextPanel({
  context,
  loading,
  error,
  profile,
  onRefresh,
  onAppendSelection,
}: JobContextPanelProps) {
  const [resumes, setResumes] = useState<ResumeVariant[]>([]);
  const [expanded, setExpanded] = useState(false);

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

  const descriptionPreview =
    context?.description && context.description.length > 400 && !expanded
      ? `${context.description.slice(0, 400)}…`
      : context?.description;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading} onClick={() => void onRefresh()}>
          {loading ? 'Scanning…' : 'Scan page'}
        </Button>
        <Button variant="secondary" disabled={loading} onClick={() => void onAppendSelection()}>
          Add selection
        </Button>
      </div>

      {error ? <StatusBanner message={error} tone="info" /> : null}

      {context ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{context.title || 'Unknown role'}</p>
              <p className="text-slate-600">{context.company || 'Unknown company'}</p>
            </div>
            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {SOURCE_LABELS[context.source]}
            </span>
          </div>

          {context.description ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Job description
              </p>
              <p className="whitespace-pre-wrap text-slate-700">{descriptionPreview}</p>
              {context.description.length > 400 ? (
                <button
                  type="button"
                  className="mt-1 text-xs text-indigo-600 hover:underline"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-slate-500">No description extracted. Use Add selection on the page.</p>
          )}

          {context.url ? (
            <a
              href={context.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-indigo-600 hover:underline"
            >
              {context.url}
            </a>
          ) : null}
        </div>
      ) : !loading && !error ? (
        <p className="text-sm text-slate-500">Open a job posting, then click Scan page.</p>
      ) : null}

      {skillMatch && context?.description ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-900">Skill match — {skillMatch.score}%</p>
          {skillMatch.matched.length > 0 ? (
            <p className="mt-1 text-green-800">
              Matched: {skillMatch.matched.map((m) => m.skill.name).join(', ')}
            </p>
          ) : (
            <p className="mt-1 text-amber-700">No profile skills matched this description.</p>
          )}
          {skillMatch.missing.length > 0 ? (
            <p className="mt-1 text-slate-600">Gaps: {skillMatch.missing.join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      {resumeMatch && context?.description ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
          <p className="font-medium text-indigo-900">Recommended resume</p>
          <p className="text-indigo-800">
            {resumeMatch.resume.name} ({resumeMatch.confidence}% match)
          </p>
        </div>
      ) : null}
    </div>
  );
}
