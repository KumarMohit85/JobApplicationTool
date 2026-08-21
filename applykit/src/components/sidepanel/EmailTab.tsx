import { useEffect, useState } from 'react';
import type { GeneratedContent } from '@/types/generated';
import type { AiGeneratedContent, AiGenerateRequest } from '@/types/ai';
import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';
import type { AiResumeSummary } from '@/types/ai';
import type { ResumeVariant } from '@/types/resume';
import { copyToClipboard } from '@/lib/clipboard';
import { insertTextToActiveTab } from '@/lib/tab-messages';
import { useAiGenerate } from '@/hooks/useAiGenerate';
import { Button, StatusBanner, TextArea } from '@/components/ui';

type EmailTabProps = {
  generated: GeneratedContent | null;
  hasContext: boolean;
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
    driveUrl: r.driveUrl,
  };
}

export function EmailTab({
  generated,
  hasContext,
  context,
  profile,
  selectedResumeId,
  resumes,
  matchedSkillNames,
}: EmailTabProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
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
    setSubject(generated?.coldEmail.subject ?? '');
    setBody(generated?.coldEmail.body ?? '');
  }, [generated]);

  // Apply AI result when it arrives
  useEffect(() => {
    if (aiContent?.coldEmail) {
      setSubject(aiContent.coldEmail.subject);
      setBody(aiContent.coldEmail.body);
    }
  }, [aiContent]);

  if (!hasContext) {
    return <StatusBanner message="Scan a job page to generate email text." tone="info" />;
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
      await copyToClipboard(`Subject: ${subject}\n\n${body}`);
      setFeedback({ message: 'Copied to clipboard.', tone: 'success' });
    } catch {
      setFeedback({ message: 'Copy failed.', tone: 'error' });
    }
  };

  const handleInsert = async () => {
    setFeedback(null);
    const result = await insertTextToActiveTab(body);
    setFeedback(
      result.success
        ? { message: 'Inserted into the page field.', tone: 'success' }
        : { message: result.error ?? 'Insert failed.', tone: 'error' },
    );
  };

  const handleReset = () => {
    setSubject(generated.coldEmail.subject);
    setBody(generated.coldEmail.body);
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
        <span className="text-xs text-slate-500">Edit before sending.</span>
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

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-700">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </label>
      <TextArea rows={10} value={body} onChange={setBody} />
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
