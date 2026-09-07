import { useEffect, useState } from 'react';
import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import type { ScannedField } from '@/types/answers';
import type { AutofillResult, LastAutofillPayload } from '@/lib/autofill-types';
import { LAST_AUTOFILL_STORAGE_KEY } from '@/lib/autofill-types';
import {
  buildResumeFilePayload,
  fillFieldOnActiveTab,
  formatAutofillMessage,
  runAutofillOnActiveTab,
} from '@/lib/autofill-client';
import { appendActivityLog } from '@/lib/activity-log';
import { addQueueItem, updateQueueItem } from '@/lib/queue';
import {
  ACTIVE_APPLY_STORAGE_KEY,
  clearActiveApplySession,
  findNextPendingLinkApply,
  getActiveApplySession,
  startQueuedFormApply,
} from '@/lib/queue-apply';
import { Button, StatusBanner } from '@/components/ui';

type SidePanelFooterProps = {
  context: JobContext | null;
  profile: Profile;
  selectedResume: ResumeVariant | null;
  coverLetter?: string;
};

export function SidePanelFooter({
  context,
  profile,
  selectedResume,
  coverLetter,
}: SidePanelFooterProps) {
  const [loading, setLoading] = useState<'easy_apply' | 'form' | 'queue' | 'next' | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  );
  const [forceFill, setForceFill] = useState(false);
  const [unmapped, setUnmapped] = useState<ScannedField[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sessionItemId, setSessionItemId] = useState<string | null>(null);

  useEffect(() => {
    const refreshSession = () => {
      void getActiveApplySession().then((s) => setSessionItemId(s?.queueItemId ?? null));
    };
    refreshSession();

    const ingest = (result: AutofillResult) => {
      setUnmapped(result.unmappedFields ?? []);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const field of result.unmappedFields ?? []) {
          if (next[field.question] == null) next[field.question] = '';
        }
        return next;
      });
      setFeedback({
        message: formatAutofillMessage(result),
        tone: result.errors.length > 0 ? 'error' : result.filledCount > 0 ? 'success' : 'info',
      });
    };

    void chrome.storage.session.get(LAST_AUTOFILL_STORAGE_KEY).then((stored) => {
      const payload = stored[LAST_AUTOFILL_STORAGE_KEY] as LastAutofillPayload | undefined;
      if (payload?.result) ingest(payload.result);
    });

    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'session') return;
      if (changes[LAST_AUTOFILL_STORAGE_KEY]?.newValue) {
        const payload = changes[LAST_AUTOFILL_STORAGE_KEY].newValue as LastAutofillPayload;
        if (payload?.result) ingest(payload.result);
      }
      if (changes[ACTIVE_APPLY_STORAGE_KEY]) {
        refreshSession();
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  if (!profile.personal.fullName) return null;

  const isLinkedIn =
    context?.source === 'linkedin' || Boolean(context?.url?.includes('linkedin.com'));

  const applyResult = (result: AutofillResult, error?: string) => {
    setUnmapped(result.unmappedFields ?? []);
    const nextDrafts: Record<string, string> = {};
    for (const field of result.unmappedFields ?? []) {
      nextDrafts[field.question] = drafts[field.question] ?? '';
    }
    setDrafts(nextDrafts);
    setFeedback({
      message: formatAutofillMessage(result, error),
      tone: error || result.errors.length > 0 ? 'error' : result.filledCount > 0 ? 'success' : 'info',
    });
  };

  const runAutofill = async (mode: 'easy_apply' | 'form') => {
    setLoading(mode);
    setFeedback(null);

    const resumeFile = await buildResumeFilePayload(selectedResume);
    const { result, error } = await runAutofillOnActiveTab({
      mode,
      forceFill,
      coverLetter,
      resumeFile,
      useAi: true,
    });

    setLoading(null);
    applyResult(result, error);

    if (!error && result.filledCount > 0 && context) {
      void appendActivityLog({
        action: mode === 'easy_apply' ? 'easy_apply_fill' : 'form_fill',
        company: context.company,
        role: context.title,
        url: context.url,
        resumeId: selectedResume?.id,
        resumeName: selectedResume?.name,
      });
    }
  };

  const saveUnmappedAnswer = async (question: string) => {
    const value = (drafts[question] ?? '').trim();
    if (!value) return;
    const filled = await fillFieldOnActiveTab(question, value);
    void chrome.runtime.sendMessage({ type: 'SAVE_CUSTOM_ANSWER', question, answer: value, source: 'user_confirmed' });
    setUnmapped((prev) => prev.filter((f) => f.question !== question));
    setFeedback({
      message: filled ? 'Saved and filled on the page. You can still edit it in the form.' : 'Saved for future forms.',
      tone: 'success',
    });
  };

  const saveToQueue = async () => {
    if (!context) {
      setFeedback({ message: 'Scan a job page first.', tone: 'info' });
      return;
    }

    setLoading('queue');
    setFeedback(null);

    const { item, duplicate } = await addQueueItem({
      type: 'job_scan',
      company: context.company,
      role: context.title,
      description: context.description,
      sourceUrl: context.url,
      resumeId: selectedResume?.id,
    });

    setLoading(null);
    if (duplicate) {
      setFeedback({ message: 'Already in queue (same apply link or the same company + role).', tone: 'info' });
    } else if (item) {
      setFeedback({ message: 'Saved to queue.', tone: 'success' });
      void appendActivityLog({
        action: 'queued',
        company: context.company,
        role: context.title,
        url: context.url,
        resumeId: selectedResume?.id,
        resumeName: selectedResume?.name,
      });
    } else {
      setFeedback({ message: 'Could not save to queue.', tone: 'error' });
    }
  };

  const markAppliedAndMaybeNext = async (goNext: boolean) => {
    if (sessionItemId) {
      await updateQueueItem(sessionItemId, { status: 'applied' });
      if (context) {
        void appendActivityLog({
          action: 'job_applied',
          company: context.company,
          role: context.title,
          url: context.url,
          resumeId: selectedResume?.id,
          resumeName: selectedResume?.name,
        });
      }
    }

    if (!goNext) {
      await clearActiveApplySession();
      setSessionItemId(null);
      setFeedback({ message: 'Marked applied. Click Submit on the page if you have not already.', tone: 'success' });
      return;
    }

    setLoading('next');
    const next = await findNextPendingLinkApply(sessionItemId ?? undefined);
    await clearActiveApplySession();
    if (!next) {
      setSessionItemId(null);
      setLoading(null);
      setFeedback({ message: 'Marked applied. No more pending link jobs in the queue.', tone: 'info' });
      return;
    }
    const started = await startQueuedFormApply(next);
    setSessionItemId(next.id);
    setLoading(null);
    setFeedback({
      message: started.ok ? `Opened next: ${next.company} — ${next.role}` : started.error ?? 'Could not open next job.',
      tone: started.ok ? 'success' : 'error',
    });
  };

  return (
    <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-slate-50 pt-3">
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
          {loading === 'form' ? 'Filling…' : 'Fill form'}
        </Button>
        <Button variant="secondary" disabled={loading != null} onClick={() => void saveToQueue()}>
          {loading === 'queue' ? 'Saving…' : 'Save to queue'}
        </Button>
      </div>

      {sessionItemId ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={loading != null} onClick={() => void markAppliedAndMaybeNext(false)}>
            Mark applied
          </Button>
          <Button disabled={loading != null} onClick={() => void markAppliedAndMaybeNext(true)}>
            {loading === 'next' ? 'Opening…' : 'Mark applied & next'}
          </Button>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={forceFill}
          onChange={(e) => setForceFill(e.target.checked)}
          className="rounded border-slate-300"
        />
        Force fill (overwrite existing values)
      </label>

      {unmapped.length > 0 ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-semibold text-amber-900">Needs you ({unmapped.length})</p>
          <p className="text-[11px] text-amber-800">
            Type an answer to save it for next time, or edit the field directly on the page.
          </p>
          {unmapped.map((field) => (
            <div key={field.question} className="space-y-1 rounded bg-white p-2">
              <p className="text-xs font-medium text-slate-800">{field.question}</p>
              {field.options && field.options.length > 0 ? (
                <select
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={drafts[field.question] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [field.question]: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  value={drafts[field.question] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [field.question]: e.target.value }))}
                  placeholder="Answer for this and future forms"
                />
              )}
              <button
                type="button"
                className="text-xs font-medium text-indigo-600 hover:underline"
                onClick={() => void saveUnmappedAnswer(field.question)}
              >
                Save & fill
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {feedback ? <StatusBanner message={feedback.message} tone={feedback.tone} /> : null}
    </div>
  );
}
