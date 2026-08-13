import { useState } from 'react';
import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import {
  buildResumeFilePayload,
  formatAutofillMessage,
  runAutofillOnActiveTab,
} from '@/lib/autofill-client';
import { addQueueItem } from '@/lib/queue';
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
  const [loading, setLoading] = useState<'easy_apply' | 'form' | 'queue' | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  );
  const [forceFill, setForceFill] = useState(false);

  if (!profile.personal.fullName) return null;

  const isLinkedIn =
    context?.source === 'linkedin' || Boolean(context?.url?.includes('linkedin.com'));

  const runAutofill = async (mode: 'easy_apply' | 'form') => {
    setLoading(mode);
    setFeedback(null);

    const resumeFile = await buildResumeFilePayload(selectedResume);
    const { result, error } = await runAutofillOnActiveTab({
      mode,
      forceFill,
      coverLetter,
      resumeFile,
    });

    setLoading(null);
    setFeedback({
      message: formatAutofillMessage(result, error),
      tone: error || result.errors.length > 0 ? 'error' : result.filledCount > 0 ? 'success' : 'info',
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
      setFeedback({ message: 'Already in queue (same URL or role).', tone: 'info' });
    } else if (item) {
      setFeedback({ message: 'Saved to queue.', tone: 'success' });
    } else {
      setFeedback({ message: 'Could not save to queue.', tone: 'error' });
    }
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
