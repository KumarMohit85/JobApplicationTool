import { useEffect, useState } from 'react';
import type { QueueItem } from '@/types/queue';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import type { AiGenerateResponse } from '@/types/ai';
import { listResumes } from '@/lib/resumes';
import { prepareMailSend } from '@/lib/mail-send';
import { appendActivityLog } from '@/lib/activity-log';
import { Button, StatusBanner } from '@/components/ui';

type EmailComposerModalProps = {
  item: QueueItem;
  profile: Profile;
  onClose: () => void;
  onSent: (item: QueueItem) => void;
};

export function EmailComposerModal({
  item,
  profile,
  onClose,
  onSent,
}: EmailComposerModalProps) {
  const [toEmail, setToEmail] = useState(item.email || '');
  const [fromEmail, setFromEmail] = useState(profile.personal.email || '');
  const [subject, setSubject] = useState(
    `Application for ${item.role} — ${profile.personal.fullName || 'Applicant'}`,
  );
  const [body, setBody] = useState('');
  const [resumes, setResumes] = useState<ResumeVariant[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    item.resumeId || '',
  );

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  );

  useEffect(() => {
    void listResumes().then((list) => {
      setResumes(list);
      const active = list.find((r) => r.id === selectedResumeId) || list[0];
      if (!selectedResumeId && active) {
        setSelectedResumeId(active.id);
      }

      const resumeLine = active?.driveUrl
        ? `You can view my resume online at: ${active.driveUrl}`
        : 'Please find my resume attached for your review.';
      const initialBody = `Dear Hiring Team at ${item.company},\n\nI am writing to express my strong interest in the ${item.role} position.\n\n${profile.summary ? profile.summary + '\n\n' : ''}${resumeLine}\n\nI would welcome the opportunity to discuss how my background aligns with your requirements.\n\nBest regards,\n${profile.personal.fullName || 'Applicant'}\n${profile.personal.linkedIn ? 'LinkedIn: ' + profile.personal.linkedIn + '\n' : ''}${profile.personal.phone ? 'Phone: ' + profile.personal.phone : ''}`;
      setBody(initialBody);
    });
  }, [item, profile]);

  const handleGenerateAi = async () => {
    setGenerating(true);
    setStatus({ message: '✨ Gemini AI is drafting your cold email…', tone: 'info' });

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'AI_GENERATE',
        request: {
          profile,
          job: {
            title: item.role,
            company: item.company,
            description: item.description,
            url: item.sourceUrl,
            source: 'linkedin',
            extractedAt: new Date().toISOString(),
          },
          matchedSkillNames: profile.skills.map((s) => s.name),
          resumes: resumes.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description || '',
            skills: r.skills || [],
            targetRoles: r.targetRoles || [],
            driveUrl: r.driveUrl,
          })),
          selectedResumeId,
          mode: 'content',
        },
      })) as AiGenerateResponse;

      if (response.ok && response.content) {
        if (response.content.coldEmail?.subject) {
          setSubject(response.content.coldEmail.subject);
        }
        if (response.content.coldEmail?.body) {
          setBody(response.content.coldEmail.body);
        }
        setStatus({ message: '✨ AI drafted tailored email successfully!', tone: 'success' });
      } else {
        setStatus({ message: response.error || 'AI generation failed.', tone: 'error' });
      }
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : 'AI generation error.', tone: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectResume = (id: string) => {
    setSelectedResumeId(id);
    const chosen = resumes.find((r) => r.id === id);
    if (chosen?.driveUrl && !body.includes(chosen.driveUrl)) {
      setBody((prev) => `${prev}\n\nYou can view my resume online at: ${chosen.driveUrl}`);
    }
  };

  const handleSendMail = async () => {
    if (!toEmail.trim()) {
      setStatus({ message: 'Recipient email is required.', tone: 'error' });
      return;
    }

    setSending(true);
    setStatus(null);

    const updatedItem: QueueItem = {
      ...item,
      email: toEmail.trim(),
      resumeId: selectedResumeId || undefined,
    };

    const result = await prepareMailSend(updatedItem, body, subject);
    setSending(false);

    if (result.success) {
      void appendActivityLog({
        action: 'email_sent',
        company: item.company,
        role: item.role,
        url: item.sourceUrl,
        resumeId: selectedResumeId,
      });
      onSent(updatedItem);
      onClose();
    } else {
      setStatus({ message: result.message, tone: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              📧 Compose Email — {item.company}
            </h3>
            <p className="text-xs text-slate-500">{item.role}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {status ? <StatusBanner message={status.message} tone={status.tone} /> : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                From
              </label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                To (Recruiter / Hiring Team)
              </label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="recruiter@company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Subject
              </label>
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGenerateAi()}
                className="text-xs font-medium text-purple-600 hover:text-purple-800 disabled:opacity-50"
              >
                {generating ? '✨ Drafting with AI…' : '✨ Auto-fill with AI'}
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Application for Software Engineer"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Resume Selection & GDrive link */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Attached Resume / GDrive Link
              </label>
              {resumes.find((r) => r.id === selectedResumeId)?.driveUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    const driveUrl = resumes.find((r) => r.id === selectedResumeId)?.driveUrl;
                    if (driveUrl && !body.includes(driveUrl)) {
                      setBody((prev) => `${prev}\n\nYou can also view my resume on Google Drive here: ${driveUrl}`);
                    }
                  }}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                >
                  📂 + Add GDrive link to body
                </button>
              ) : null}
            </div>
            <select
              value={selectedResumeId}
              onChange={(e) => handleSelectResume(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            >
              {resumes.length === 0 ? (
                <option value="">No resumes uploaded (add in Settings → Resumes)</option>
              ) : (
                resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    📄 {r.name} {r.driveUrl ? '(🔗 GDrive Link)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Email Body (Editable)
            </label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateAi()}
              className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
            >
              {generating ? '✨ AI Working…' : '✨ AI Generate Body'}
            </button>

            <Button disabled={sending} onClick={() => void handleSendMail()}>
              {sending ? 'Opening Gmail…' : '📧 Open Gmail & Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
