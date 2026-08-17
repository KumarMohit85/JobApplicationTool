import { useState } from 'react';
import type { Profile } from '@/types/profile';
import { useCloudSync } from '@/hooks/useCloudSync';
import { Button, StatusBanner } from '@/components/ui';

type CloudSyncTabProps = {
  profile: Profile;
  onProfilePulled: (profile: Profile) => void;
};

export function CloudSyncTab({ profile, onProfilePulled }: CloudSyncTabProps) {
  const {
    settings,
    githubToken,
    loading,
    op,
    error,
    successMessage,
    setSettings,
    setGithubToken,
    save,
    push,
    pull,
  } = useCloudSync();

  const [showToken, setShowToken] = useState(false);

  const handlePush = async () => {
    await push(profile);
  };

  const handlePull = async () => {
    const result = await pull();
    if (result) {
      onProfilePulled(result.profile);
    }
  };

  if (loading) return <StatusBanner message="Loading cloud sync settings…" tone="info" />;

  const busy = op !== 'idle';
  const isGist = settings.provider === 'github_gist';
  const isUrl = settings.provider === 'url';

  const canPush = isGist && githubToken.trim().length > 5 && settings.enabled;
  const canPull =
    settings.enabled &&
    ((isGist && githubToken.trim().length > 5 && Boolean(settings.gistId)) ||
      (isUrl && Boolean(settings.profileUrl)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50 p-4">
        <p className="text-sm font-medium text-sky-900">☁️ Cloud profile & resume sync</p>
        <p className="mt-1 text-xs text-sky-700">
          Back up your full profile and resume PDFs (Base64) to a private GitHub Gist, or import
          from any public JSON URL. Use this to sync your profile and resumes across devices.
        </p>
      </div>

      {error ? <StatusBanner message={error} tone="error" /> : null}
      {successMessage ? <StatusBanner message={successMessage} tone="success" /> : null}

      {/* Enable */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          id="cloud-enabled"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          checked={settings.enabled}
          onChange={(e) => setSettings({ enabled: e.target.checked })}
        />
        <span className="text-sm font-medium text-slate-900">Enable cloud sync</span>
      </label>

      {/* Provider */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-provider">
          Provider
        </label>
        <select
          id="cloud-provider"
          value={settings.provider}
          onChange={(e) =>
            setSettings({ provider: e.target.value as 'github_gist' | 'url' })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        >
          <option value="github_gist">GitHub Gist (push + pull)</option>
          <option value="url">Read-only URL (pull only)</option>
        </select>
      </div>

      {/* GitHub Gist fields */}
      {isGist && (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-token">
              GitHub Personal Access Token
            </label>
            <div className="relative">
              <input
                id="cloud-token"
                type={showToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Create a token at{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=gist&description=ApplyKit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
              >
                GitHub → Settings → Developer settings → Tokens
              </a>{' '}
              with <code className="rounded bg-slate-100 px-1">gist</code> scope only.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-gist-id">
              Gist ID{' '}
              <span className="font-normal text-slate-500">(auto-filled after first push)</span>
            </label>
            <input
              id="cloud-gist-id"
              type="text"
              value={settings.gistId ?? ''}
              onChange={(e) => setSettings({ gistId: e.target.value || undefined })}
              placeholder="a1b2c3d4e5f6…"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </>
      )}

      {/* URL field */}
      {isUrl && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-profile-url">
            Profile JSON URL
          </label>
          <input
            id="cloud-profile-url"
            type="url"
            value={settings.profileUrl ?? ''}
            onChange={(e) => setSettings({ profileUrl: e.target.value || undefined })}
            placeholder="https://gist.githubusercontent.com/…/applykit-profile.json"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <p className="text-xs text-slate-500">
            Paste the raw URL of a publicly accessible JSON file. Used for pull/import only.
          </p>
        </div>
      )}

      {/* Options */}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            id="cloud-cache-locally"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={settings.cacheLocally}
            onChange={(e) => setSettings({ cacheLocally: e.target.checked })}
          />
          <span className="text-sm text-slate-700">Cache pulled profile locally (offline fallback)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            id="cloud-primary"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={settings.cloudPrimary}
            onChange={(e) => setSettings({ cloudPrimary: e.target.checked })}
          />
          <span className="text-sm text-slate-700">
            Cloud is source of truth (auto-pull on extension start)
          </span>
        </label>
      </div>

      {/* Last synced */}
      {settings.lastSyncedAt ? (
        <p className="text-xs text-slate-500">
          Last synced: {new Date(settings.lastSyncedAt).toLocaleString()}
        </p>
      ) : null}

      {/* Privacy */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Privacy:</strong> Push sends your full profile JSON (name, contact, experience,
        skills) to GitHub Gist API. Use a private Gist (default). Do not enable if your GitHub
        account is shared.
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void save()}>
          Save settings
        </Button>
        {isGist && (
          <Button variant="secondary" disabled={!canPush || busy} onClick={() => void handlePush()}>
            {op === 'pushing' ? 'Pushing…' : '⬆ Push to Gist'}
          </Button>
        )}
        <Button variant="secondary" disabled={!canPull || busy} onClick={() => void handlePull()}>
          {op === 'pulling' ? 'Pulling…' : '⬇ Pull from cloud'}
        </Button>
      </div>

      {canPull && op === 'idle' && (
        <p className="text-xs text-slate-400">
          Pulling automatically restores and saves your profile data and resume PDFs locally.
        </p>
      )}
    </div>
  );
}
