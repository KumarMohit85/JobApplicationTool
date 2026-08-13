import { useEffect, useMemo, useState } from 'react';
import type { JobContext } from '@/types/job';
import type { GeneratedContent } from '@/types/generated';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import { copyToClipboard } from '@/lib/clipboard';
import { canGenerateContent, generateContent } from '@/lib/generator';
import { matchResume, matchSkills } from '@/lib/matcher';
import { listResumes } from '@/lib/resumes';
import { insertTextToActiveTab } from '@/lib/tab-messages';
import { Button, StatusBanner, TextArea } from '@/components/ui';

type ContentTab = 'fit' | 'cover' | 'email';

type GeneratedContentPanelProps = {
  context: JobContext | null;
  profile: Profile;
};

export function GeneratedContentPanel({ context, profile }: GeneratedContentPanelProps) {
  const [activeTab, setActiveTab] = useState<ContentTab>('cover');
  const [resumes, setResumes] = useState<ResumeVariant[]>([]);
  const [draft, setDraft] = useState<GeneratedContent | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(
    null,
  );

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

  const generated = useMemo(() => {
    if (!context || !canGenerateContent(context)) return null;
    const matchedSkillNames = skillMatch?.matched.map((m) => m.skill.name) ?? [];
    return generateContent({
      profile,
      job: context,
      matchedSkillNames,
      resumeName: resumeMatch?.resume.name,
    });
  }, [context, profile, skillMatch, resumeMatch]);

  useEffect(() => {
    if (generated) {
      setDraft(generated);
      setEmailSubject(generated.coldEmail.subject);
    } else {
      setDraft(null);
      setEmailSubject('');
    }
  }, [generated]);

  if (!context) {
    return null;
  }

  if (!canGenerateContent(context)) {
    return (
      <StatusBanner
        message="Scan a job page or add a description to generate cover letter and email text."
        tone="info"
      />
    );
  }

  if (!draft) {
    return null;
  }

  const tabs: { id: ContentTab; label: string }[] = [
    { id: 'fit', label: 'Fit' },
    { id: 'cover', label: 'Cover' },
    { id: 'email', label: 'Email' },
  ];

  const currentText =
    activeTab === 'fit'
      ? draft.fitParagraph
      : activeTab === 'cover'
        ? draft.coverLetter
        : draft.coldEmail.body;

  const setCurrentText = (value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (activeTab === 'fit') return { ...prev, fitParagraph: value };
      if (activeTab === 'cover') return { ...prev, coverLetter: value };
      return { ...prev, coldEmail: { ...prev.coldEmail, body: value } };
    });
  };

  const handleCopy = async () => {
    setFeedback(null);
    try {
      if (activeTab === 'email') {
        const full = `Subject: ${emailSubject}\n\n${draft.coldEmail.body}`;
        await copyToClipboard(full);
      } else {
        await copyToClipboard(currentText);
      }
      setFeedback({ message: 'Copied to clipboard.', tone: 'success' });
    } catch {
      setFeedback({ message: 'Copy failed. Select the text and copy manually.', tone: 'error' });
    }
  };

  const handleInsert = async () => {
    setFeedback(null);
    const result = await insertTextToActiveTab(currentText);
    if (result.success) {
      setFeedback({ message: 'Inserted into the page field.', tone: 'success' });
    } else {
      setFeedback({ message: result.error ?? 'Insert failed.', tone: 'error' });
    }
  };

  const handleReset = () => {
    if (generated) {
      setDraft(generated);
      setEmailSubject(generated.coldEmail.subject);
      setFeedback({ message: 'Reset to generated text.', tone: 'success' });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Generated content</h2>
        <p className="text-xs text-slate-500">Edit before copying or inserting into a form.</p>
      </div>

      <nav className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'email' ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-700">Subject</span>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </label>
      ) : null}

      <TextArea rows={10} value={currentText} onChange={setCurrentText} />

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
