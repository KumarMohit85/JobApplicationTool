import { useEffect, useState } from 'react';
import type { GeneratedContent } from '@/types/generated';
import { copyToClipboard } from '@/lib/clipboard';
import { insertTextToActiveTab } from '@/lib/tab-messages';
import { Button, StatusBanner, TextArea } from '@/components/ui';

type EmailTabProps = {
  generated: GeneratedContent | null;
  hasContext: boolean;
};

export function EmailTab({ generated, hasContext }: EmailTabProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(
    null,
  );

  useEffect(() => {
    setSubject(generated?.coldEmail.subject ?? '');
    setBody(generated?.coldEmail.body ?? '');
  }, [generated]);

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
    setFeedback({ message: 'Reset to generated text.', tone: 'success' });
  };

  return (
    <div className="space-y-3">
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
