import { useProfile } from '@/hooks/useProfile';
import { useJobContext } from '@/hooks/useJobContext';
import { JobContextPanel } from '@/components/sidepanel/JobContextPanel';
import { Button, StatusBanner } from '@/components/ui';

export default function SidePanelApp() {
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const {
    context,
    loading: jobLoading,
    error: jobError,
    refresh,
    appendSelection,
  } = useJobContext(true);

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">ApplyKit</h1>
        <p className="text-sm text-slate-600">Job context from the current tab</p>
      </div>

      {profileLoading ? <StatusBanner message="Loading profile…" tone="info" /> : null}
      {profileError ? <StatusBanner message={profileError} tone="error" /> : null}

      {!profileLoading && !profile.personal.fullName ? (
        <StatusBanner
          message="Complete your profile in settings to enable matching and autofill."
          tone="info"
        />
      ) : null}

      {!profileLoading && profile.personal.fullName ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="font-medium text-slate-900">{profile.personal.fullName}</p>
          <p className="text-slate-600">{profile.personal.headline || profile.personal.email}</p>
          {profile.skills.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">{profile.skills.length} skills saved</p>
          ) : null}
        </div>
      ) : null}

      <JobContextPanel
        context={context}
        loading={jobLoading}
        error={jobError}
        profile={profile}
        onRefresh={refresh}
        onAppendSelection={appendSelection}
      />

      <Button variant="secondary" onClick={openOptions}>
        Open profile settings
      </Button>
    </div>
  );
}
