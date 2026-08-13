import { useState } from 'react';
import { Button, StatusBanner } from '@/components/ui';
import { formatAutofillMessage, runAutofillOnActiveTab } from '@/lib/autofill-client';
import { fetchJobContextFromActiveTab } from '@/lib/tab-messages';
import '@/assets/tailwind.css';

export default function PopupApp() {
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filling, setFilling] = useState(false);

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  };

  const scanPage = async () => {
    setScanning(true);
    setScanMessage(null);
    const result = await fetchJobContextFromActiveTab();
    setScanning(false);
    if (result.context) {
      const parts = [result.context.title, result.context.company].filter(Boolean);
      setScanMessage(parts.length > 0 ? `Found: ${parts.join(' at ')}` : 'Job context saved.');
      await openSidePanel();
    } else {
      setScanMessage(result.error ?? 'No job details found on this page.');
    }
  };

  const fillForm = async () => {
    setFilling(true);
    setScanMessage(null);
    const { result, error } = await runAutofillOnActiveTab({ mode: 'form' });
    setFilling(false);
    setScanMessage(formatAutofillMessage(result, error));
  };

  return (
    <div className="w-72 space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">ApplyKit</h1>
        <p className="text-xs text-slate-600">Job application assistant</p>
      </div>

      {scanMessage ? <StatusBanner message={scanMessage} tone="info" /> : null}

      <div className="space-y-2">
        <Button disabled={scanning} onClick={() => void scanPage()}>
          {scanning ? 'Scanning…' : 'Scan job page'}
        </Button>
        <Button disabled={filling} onClick={() => void fillForm()}>
          {filling ? 'Filling…' : 'Fill form on page'}
        </Button>
        <Button variant="secondary" onClick={() => void openSidePanel()}>
          Open side panel
        </Button>
        <Button variant="secondary" onClick={openOptions}>
          Profile settings
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Works on LinkedIn, Greenhouse, Lever, and most job posting pages.
      </p>
    </div>
  );
}
