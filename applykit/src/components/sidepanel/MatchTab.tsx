import { useCallback } from 'react';
import type { SkillMatchResult, ResumeMatchResult } from '@/lib/matcher';
import type { ResumeVariant } from '@/types/resume';
import type { AiJobReview, AiGenerateRequest } from '@/types/ai';
import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';
import type { AiResumeSummary } from '@/types/ai';
import { ConfidenceBar } from '@/components/sidepanel/ConfidenceBar';
import { StatusBanner } from '@/components/ui';
import { useAiGenerate } from '@/hooks/useAiGenerate';

type MatchTabProps = {
  contextDescription: string | undefined;
  skillMatch: SkillMatchResult | null;
  resumeMatch: ResumeMatchResult | null;
  resumes: ResumeVariant[];
  selectedResumeId: string;
  onSelectResume: (id: string) => void;
  // AI context
  context: JobContext | null;
  profile: Profile;
  matchedSkillNames: string[];
};

const DECISION_STYLES = {
  apply: {
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    label: '✅ Strong match — Apply',
  },
  maybe: {
    badge: 'bg-amber-100 text-amber-800 border border-amber-200',
    label: '🤔 Partial match — Maybe',
  },
  skip: {
    badge: 'bg-rose-100 text-rose-800 border border-rose-200',
    label: '⏭ Poor fit — Skip',
  },
} as const;

function toAiResumeSummary(r: ResumeVariant): AiResumeSummary {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    skills: r.skills,
    targetRoles: r.targetRoles,
  };
}

export function MatchTab({
  contextDescription,
  skillMatch,
  resumeMatch,
  resumes,
  selectedResumeId,
  onSelectResume,
  context,
  profile,
  matchedSkillNames,
}: MatchTabProps) {
  const {
    result: aiReview,
    loading: aiLoading,
    error: aiError,
    generate: generateAi,
  } = useAiGenerate<AiJobReview>((r) => r.review);

  const handleAiReview = useCallback(async () => {
    if (!context) return;
    const request: AiGenerateRequest = {
      mode: 'review',
      profile,
      job: context,
      matchedSkillNames,
      resumes: resumes.map(toAiResumeSummary),
      selectedResumeId: selectedResumeId || undefined,
    };
    await generateAi(request);
  }, [context, profile, matchedSkillNames, resumes, selectedResumeId, generateAi]);

  if (!contextDescription) {
    return (
      <StatusBanner
        message="Scan a job page first to see skill and resume matching."
        tone="info"
      />
    );
  }

  const decisionStyle = aiReview ? DECISION_STYLES[aiReview.decision] : null;

  return (
    <div className="space-y-4">
      {/* Rule-based skill match */}
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

      {/* Resume picker */}
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

      {/* AI Review card */}
      <div className="rounded-lg border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-3 text-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium text-purple-900">🤖 AI Review</p>
          <button
            type="button"
            disabled={aiLoading || !context}
            onClick={() => void handleAiReview()}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {aiLoading ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyzing…
              </>
            ) : aiReview ? (
              '↻ Re-analyze'
            ) : (
              'Get AI suggestion'
            )}
          </button>
        </div>

        {aiError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
            {aiError.includes('API key') || aiError.includes('Options')
              ? '⚙️ Add your Gemini API key in Options → ✨ AI settings to use AI Review.'
              : aiError}
          </div>
        ) : null}

        {!aiReview && !aiLoading && !aiError ? (
          <p className="text-xs text-purple-700">
            Get an AI assessment of your fit, apply/skip advice, and which resume to use.
          </p>
        ) : null}

        {aiReview && decisionStyle ? (
          <div className="space-y-3">
            {/* Decision badge */}
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${decisionStyle.badge}`}>
                {decisionStyle.label}
              </span>
              <span className="text-xs text-purple-700">{aiReview.confidence}% confidence</span>
            </div>

            {/* Reasons */}
            {aiReview.reasons.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium text-emerald-800">Why apply:</p>
                <ul className="space-y-0.5">
                  {aiReview.reasons.map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-slate-700">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Risks */}
            {aiReview.risks.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium text-amber-800">Risks / gaps:</p>
                <ul className="space-y-0.5">
                  {aiReview.risks.map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-slate-700">
                      <span className="mt-0.5 text-amber-500">⚠</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Recommended resume */}
            {aiReview.recommendedResumeReason ? (
              <div className="rounded-md border border-indigo-100 bg-white px-3 py-2">
                <p className="text-xs font-medium text-indigo-900">Recommended resume</p>
                <p className="text-xs text-slate-600">{aiReview.recommendedResumeReason}</p>
                {aiReview.recommendedResumeId &&
                aiReview.recommendedResumeId !== selectedResumeId ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (aiReview.recommendedResumeId) onSelectResume(aiReview.recommendedResumeId);
                    }}
                    className="mt-1 text-xs font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                  >
                    Switch to recommended →
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
