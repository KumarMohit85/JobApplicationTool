import { Button } from '@/components/ui';
import '@/assets/tailwind.css';

export default function PopupApp() {
  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  };

  return (
    <div className="w-72 space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">ApplyKit</h1>
        <p className="text-xs text-slate-600">Job application assistant</p>
      </div>

      <div className="space-y-2">
        <Button onClick={() => void openSidePanel()}>Open side panel</Button>
        <Button variant="secondary" onClick={openOptions}>
          Profile settings
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Set up your profile first. Autofill and job tools are added in upcoming features.
      </p>
    </div>
  );
}
