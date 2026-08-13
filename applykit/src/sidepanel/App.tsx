import { useProfile } from '@/hooks/useProfile';
import { Button, StatusBanner } from '@/components/ui';

export default function SidePanelApp() {
  const { profile, loading, error } = useProfile();

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">ApplyKit</h1>
        <p className="text-sm text-slate-600">Side panel — job context and actions will appear here.</p>
      </div>

      {loading ? <StatusBanner message="Loading profile…" tone="info" /> : null}
      {error ? <StatusBanner message={error} tone="error" /> : null}

      {!loading && !profile.personal.fullName ? (
        <StatusBanner
          message="Complete your profile in settings to enable autofill and tailored applications."
          tone="info"
        />
      ) : null}

      {!loading && profile.personal.fullName ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="font-medium text-slate-900">{profile.personal.fullName}</p>
          <p className="text-slate-600">{profile.personal.headline || profile.personal.email}</p>
        </div>
      ) : null}

      <Button variant="secondary" onClick={openOptions}>
        Open profile settings
      </Button>
    </div>
  );
}
