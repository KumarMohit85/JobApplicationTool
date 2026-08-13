import type { SkillMatchResult, ResumeMatchResult } from '@/lib/matcher';
import type { ResumeVariant } from '@/types/resume';
import { ConfidenceBar } from '@/components/sidepanel/ConfidenceBar';
import { StatusBanner } from '@/components/ui';

type MatchTabProps = {
  contextDescription: string | undefined;
  skillMatch: SkillMatchResult | null;
  resumeMatch: ResumeMatchResult | null;
  resumes: ResumeVariant[];
  selectedResumeId: string;
  onSelectResume: (id: string) => void;
};

export function MatchTab({
  contextDescription,
  skillMatch,
  resumeMatch,
  resumes,
  selectedResumeId,
  onSelectResume,
}: MatchTabProps) {
  if (!contextDescription) {
    return (
      <StatusBanner
        message="Scan a job page first to see skill and resume matching."
        tone="info"
      />
    );
  }

  return (
    <div className="space-y-4">
      {skillMatch ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <ConfidenceBar label="Skill match" value={skillMatch.score} tone="green" />
          {skillMatch.matched.length > 0 ? (
            <p className="text-green-800">
              Matched: {skillMatch.matched.map((m) => m.skill.name).join(', ')}
            </p>
          ) : (
            <p className="text-amber-700">No profile skills matched this description.</p>
          )}
          {skillMatch.missing.length > 0 ? (
            <p className="text-slate-600">Gaps: {skillMatch.missing.join(', ')}</p>
          ) : null}
        </div>
      ) : (
        <StatusBanner message="Add skills in profile settings to enable skill matching." tone="info" />
      )}

      <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm">
        <p className="font-medium text-indigo-900">Resume picker</p>

        {resumes.length === 0 ? (
          <p className="text-indigo-800">Upload resumes in Options to enable matching.</p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-indigo-800">Selected resume</span>
              <select
                value={selectedResumeId}
                onChange={(e) => onSelectResume(e.target.value)}
                className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.name}
                  </option>
                ))}
              </select>
            </label>

            {resumeMatch ? (
              <ConfidenceBar
                label={`Match confidence — ${resumeMatch.resume.name}`}
                value={resumeMatch.confidence}
                tone="indigo"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
