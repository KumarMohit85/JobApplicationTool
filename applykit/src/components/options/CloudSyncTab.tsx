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
    connect,
    push,
    pull,
  } = useCloudSync();

  const [showToken, setShowToken] = useState(false);

  const handleConnect = async () => {
    const res = await connect(githubToken, settings.repo || 'applykit-backup');
    if (res?.pulledProfile) {
      onProfilePulled(res.pulledProfile);
    }
  };

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
  const isRepo = settings.provider === 'github_repo';
  const isGist = settings.provider === 'github_gist';
  const isUrl = settings.provider === 'url';

  const canConnect = isRepo && githubToken.trim().length > 5;
  const canPush =
    settings.enabled &&
    ((isRepo && githubToken.trim().length > 5) ||
      (isGist && githubToken.trim().length > 5));

  const canPull =
    settings.enabled &&
    ((isRepo && githubToken.trim().length > 5) ||
      (isGist && githubToken.trim().length > 5 && Boolean(settings.gistId)) ||
      (isUrl && Boolean(settings.profileUrl)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-4">
        <p className="text-sm font-semibold text-indigo-900">☁️ Cloud Profile & Resume Backup</p>
        <p className="mt-1 text-xs text-indigo-700">
          Sync your profile details and original resume PDFs across devices using a private GitHub repository or Gist.
          On first connection, ApplyKit checks for existing cloud data and restores it automatically.
        </p>
      </div>

      {error ? <StatusBanner message={error} tone="error" /> : null}
      {successMessage ? <StatusBanner message={successMessage} tone="success" /> : null}

      {/* Enable Toggle */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          id="cloud-enabled"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          checked={settings.enabled}
          onChange={(e) => setSettings({ enabled: e.target.checked })}
        />
        <span className="text-sm font-semibold text-slate-900">Enable cloud sync</span>
      </label>

      {/* Provider Selector */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-provider">
          Storage Architecture / Provider
        </label>
        <select
          id="cloud-provider"
          value={settings.provider}
          onChange={(e) =>
            setSettings({ provider: e.target.value as 'github_repo' | 'github_gist' | 'url' })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        >
          <option value="github_repo">
            🔒 Private GitHub Repository (Recommended — auto-creates applykit-backup)
          </option>
          <option value="github_gist">📝 GitHub Gist (Secret Gist backup)</option>
          <option value="url">🌐 Read-only JSON URL (Import only)</option>
        </select>
      </div>

      {/* GitHub Private Repo Fields */}
      {isRepo && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
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
                placeholder="ghp_… or github_pat_…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-20 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
                href="https://github.com/settings/tokens/new?scopes=repo&description=ApplyKit+Backup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
              >
                GitHub → Settings → Developer settings → Tokens
              </a>{' '}
              with <code className="rounded bg-slate-200 px-1 font-mono text-[11px]">repo</code> scope.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-repo-name">
              Repository Name
            </label>
            <input
              id="cloud-repo-name"
              type="text"
              value={settings.repo ?? 'applykit-backup'}
              onChange={(e) => setSettings({ repo: e.target.value.trim() || 'applykit-backup' })}
              placeholder="applykit-backup"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <p className="text-xs text-slate-500">
              ApplyKit will automatically create this private repository on your GitHub account if it doesn't exist yet.
            </p>
          </div>

          <div className="pt-2">
            <Button
              disabled={!canConnect || busy}
              onClick={() => void handleConnect()}
            >
              {op === 'pulling' ? 'Connecting & checking remote data…' : '⚡ Connect & Auto-Sync Cloud'}
            </Button>
          </div>
        </div>
      )}

      {/* GitHub Gist Fields */}
      {isGist && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-gist-token">
              GitHub Personal Access Token
            </label>
            <div className="relative">
              <input
                id="cloud-gist-token"
                type={showToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-20 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
              Needs <code className="rounded bg-slate-200 px-1 font-mono text-[11px]">gist</code> scope.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="cloud-gist-id">
              Gist ID <span className="font-normal text-slate-500">(auto-discovered)</span>
            </label>
            <input
              id="cloud-gist-id"
              type="text"
              value={settings.gistId ?? ''}
              onChange={(e) => setSettings({ gistId: e.target.value || undefined })}
              placeholder="Auto-detected or paste Gist ID..."
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>
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
            placeholder="https://raw.githubusercontent.com/…/profile.json"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      )}

      {/* Status Badge */}
      {settings.owner && settings.repo ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          <span>✅ Connected:</span>
          <a
            href={`https://github.com/${settings.owner}/${settings.repo}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-emerald-700"
          >
            github.com/{settings.owner}/{settings.repo}
          </a>
        </div>
      ) : null}

      {/* Additional Options */}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            id="cloud-primary"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={settings.cloudPrimary}
            onChange={(e) => setSettings({ cloudPrimary: e.target.checked })}
          />
          <span className="text-sm text-slate-700">
            Auto-pull cloud profile on extension startup
          </span>
        </label>
      </div>

      {settings.lastSyncedAt ? (
        <p className="text-xs text-slate-500">
          Last synced: {new Date(settings.lastSyncedAt).toLocaleString()}
        </p>
      ) : null}

      {/* Manual Actions */}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void save()}>
          Save settings
        </Button>
        {!isUrl && (
          <Button variant="secondary" disabled={!canPush || busy} onClick={() => void handlePush()}>
            {op === 'pushing' ? 'Pushing…' : '⬆ Push to cloud'}
          </Button>
        )}
        <Button variant="secondary" disabled={!canPull || busy} onClick={() => void handlePull()}>
          {op === 'pulling' ? 'Pulling…' : '⬇ Pull from cloud'}
        </Button>
      </div>
    </div>
  );
}
