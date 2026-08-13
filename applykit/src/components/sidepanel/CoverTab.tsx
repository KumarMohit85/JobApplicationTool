import { useEffect, useState } from 'react';
import type { GeneratedContent } from '@/types/generated';
import { copyToClipboard } from '@/lib/clipboard';
import { insertTextToActiveTab } from '@/lib/tab-messages';
import { Button, StatusBanner, TextArea } from '@/components/ui';

type CoverTabProps = {
  generated: GeneratedContent | null;
  hasContext: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
};

export function CoverTab({ generated, hasContext, draft, onDraftChange }: CoverTabProps) {
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(
    null,
  );

  useEffect(() => {
    if (generated?.coverLetter) {
      onDraftChange(generated.coverLetter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset draft when generated content changes
  }, [generated?.coverLetter]);

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
    setFeedback({ message: 'Reset to generated text.', tone: 'success' });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Edit before copying or inserting into a form.</p>
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
