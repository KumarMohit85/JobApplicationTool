import { useState } from 'react';
import { Button, StatusBanner } from '@/components/ui';
import { formatAutofillMessage, runAutofillOnActiveTab } from '@/lib/autofill-client';
import type { LinkedInPostCapturePayload } from '@/lib/job-context';
import { addQueueItem } from '@/lib/queue';
import { captureLinkedInPostFromActiveTab, fetchJobContextFromActiveTab } from '@/lib/tab-messages';
import '@/assets/tailwind.css';

export default function PopupApp() {
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'error'>('info');
  const [busy, setBusy] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState<LinkedInPostCapturePayload | null>(null);
  const [postEmail, setPostEmail] = useState('');
  const [postCompany, setPostCompany] = useState('');
  const [postRole, setPostRole] = useState('');

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  };

  const showMessage = (text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

  const scanPage = async () => {
    setBusy('scan');
    setMessage(null);
    const result = await fetchJobContextFromActiveTab();
    setBusy(null);
    if (result.context) {
      const parts = [result.context.title, result.context.company].filter(Boolean);
      showMessage(parts.length > 0 ? `Found: ${parts.join(' at ')}` : 'Job context saved.', 'success');
      await openSidePanel();
    } else {
      showMessage(result.error ?? 'No job details found on this page.', 'error');
    }
  };

  const fillForm = async () => {
    setBusy('fill');
    setMessage(null);
    const { result, error } = await runAutofillOnActiveTab({ mode: 'form' });
    setBusy(null);
    showMessage(formatAutofillMessage(result, error), error ? 'error' : 'success');
  };

  const capturePost = async () => {
    setBusy('capture');
    setMessage(null);
    setPostDraft(null);
    const { capture, error } = await captureLinkedInPostFromActiveTab();
    setBusy(null);
    if (!capture) {
      showMessage(error ?? 'No post found.', 'error');
      return;
    }
    setPostDraft(capture);
    setPostEmail(capture.emails[0] ?? '');
    setPostCompany(capture.company);
    setPostRole(capture.role);
    showMessage('Review captured post details, then save to queue.', 'info');
  };

  const savePostToQueue = async () => {
    if (!postDraft) return;
    if (!postEmail.trim()) {
      showMessage('Email is required to save a mail queue item.', 'error');
      return;
    }

    setBusy('save');
    const { item, duplicate } = await addQueueItem({
      type: 'linkedin_mail',
      email: postEmail.trim(),
      company: postCompany.trim(),
      role: postRole.trim(),
      description: postDraft.description,
      sourceUrl: postDraft.sourceUrl,
    });
    setBusy(null);

    if (duplicate) {
      showMessage('Already in queue.', 'info');
    } else if (item) {
      showMessage('Saved to mail queue.', 'success');
      setPostDraft(null);
    } else {
      showMessage('Could not save to queue.', 'error');
    }
  };

  return (
    <div className="w-80 space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">ApplyKit</h1>
        <p className="text-xs text-slate-600">Quick actions for the current tab</p>
      </div>

      {message ? <StatusBanner message={message} tone={messageTone} /> : null}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Job pages</p>
        <Button disabled={busy != null} onClick={() => void scanPage()}>
          {busy === 'scan' ? 'Scanning…' : 'Scan job page'}
        </Button>
        <Button disabled={busy != null} onClick={() => void fillForm()}>
          {busy === 'fill' ? 'Filling…' : 'Fill form on page'}
        </Button>
        <Button variant="secondary" disabled={busy != null} onClick={() => void openSidePanel()}>
          Open side panel
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">LinkedIn feed</p>
        <Button variant="secondary" disabled={busy != null} onClick={() => void capturePost()}>
          {busy === 'capture' ? 'Reading post…' : 'Save LinkedIn post'}
        </Button>
      </div>

      {postDraft ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={postEmail}
              onChange={(e) => setPostEmail(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">Company</span>
            <input
              type="text"
              value={postCompany}
              onChange={(e) => setPostCompany(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">Role</span>
            <input
              type="text"
              value={postRole}
              onChange={(e) => setPostRole(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <Button disabled={busy != null} onClick={() => void savePostToQueue()}>
            {busy === 'save' ? 'Saving…' : 'Confirm save to queue'}
          </Button>
        </div>
      ) : null}

      <Button variant="ghost" onClick={openOptions}>
        Profile settings
      </Button>
    </div>
  );
}
