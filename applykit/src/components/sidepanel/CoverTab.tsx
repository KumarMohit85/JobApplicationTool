import { useEffect, useState } from 'react';
import type { GeneratedContent } from '@/types/generated';
import type { AiGeneratedContent } from '@/types/ai';
import type { AiGenerateRequest } from '@/types/ai';
import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';
import type { AiResumeSummary } from '@/types/ai';
import type { ResumeVariant } from '@/types/resume';
import { copyToClipboard } from '@/lib/clipboard';
import { insertTextToActiveTab } from '@/lib/tab-messages';
import { useAiGenerate } from '@/hooks/useAiGenerate';
import { Button, StatusBanner, TextArea } from '@/components/ui';

type CoverTabProps = {
  generated: GeneratedContent | null;
  hasContext: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  // AI context
  context: JobContext | null;
  profile: Profile;
  selectedResumeId: string;
  resumes: ResumeVariant[];
  matchedSkillNames: string[];
};

function toAiResumeSummary(r: ResumeVariant): AiResumeSummary {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    skills: r.skills,
    targetRoles: r.targetRoles,
  };
}

export function CoverTab({
  generated,
  hasContext,
  draft,
  onDraftChange,
  context,
  profile,
  selectedResumeId,
  resumes,
  matchedSkillNames,
}: CoverTabProps) {
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(
    null,
  );

  const {
    result: aiContent,
    loading: aiLoading,
    error: aiError,
    generate: generateAi,
  } = useAiGenerate<AiGeneratedContent>((r) => r.content);

  useEffect(() => {
    if (generated?.coverLetter) {
      onDraftChange(generated.coverLetter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset draft when generated content changes
  }, [generated?.coverLetter]);

  // Apply AI result to draft when it arrives
  useEffect(() => {
    if (aiContent?.coverLetter) {
      onDraftChange(aiContent.coverLetter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when AI result changes
  }, [aiContent?.coverLetter]);

  if (!hasContext) {
    return <StatusBanner message="Scan a job page to generate a cover letter." tone="info" />;
  }

  if (!generated) {
    return (
      <StatusBanner
        message="Add a job description (scan page or add selection) to generate content."
        tone="info"
      />
    );
  }

  const handleCopy = async () => {
    setFeedback(null);
    try {
      await copyToClipboard(draft);
      setFeedback({ message: 'Copied to clipboard.', tone: 'success' });
    } catch {
      setFeedback({ message: 'Copy failed.', tone: 'error' });
    }
  };

  const handleInsert = async () => {
    setFeedback(null);
    const result = await insertTextToActiveTab(draft);
    setFeedback(
      result.success
        ? { message: 'Inserted into the page field.', tone: 'success' }
        : { message: result.error ?? 'Insert failed.', tone: 'error' },
    );
  };

  const handleReset = () => {
    onDraftChange(generated.coverLetter);
    setFeedback({ message: 'Reset to template text.', tone: 'success' });
  };

  const handleAiGenerate = async () => {
    if (!context) return;
    setFeedback(null);
    const request: AiGenerateRequest = {
      mode: 'content',
      profile,
      job: context,
      matchedSkillNames,
      resumes: resumes.map(toAiResumeSummary),
      selectedResumeId: selectedResumeId || undefined,
    };
    await generateAi(request);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Edit before copying or inserting into a form.</p>
        <button
          type="button"
          disabled={aiLoading || !context}
          onClick={() => void handleAiGenerate()}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {aiLoading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating…
            </>
          ) : (
            '✨ Generate with AI'
          )}
        </button>
      </div>

      {aiError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {aiError.includes('API key') || aiError.includes('Options')
            ? '⚙️ Add your Gemini API key in Options → ✨ AI settings to use this feature.'
            : aiError}
        </div>
      ) : null}

      <TextArea rows={12} value={draft} onChange={onDraftChange} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void handleCopy()}>Copy</Button>
        <Button variant="secondary" onClick={() => void handleInsert()}>
          Insert on page
        </Button>
        <Button variant="ghost" onClick={handleReset}>
          Reset
        </Button>
      </div>
      {feedback ? <StatusBanner message={feedback.message} tone={feedback.tone} /> : null}
    </div>
  );
}
