import { useRef, useState } from 'react';
import type { Profile } from '@/types/profile';
import { csvToQueueItems, downloadCsv, queueToCsv } from '@/lib/csv';
import {
  clearProfile,
  downloadJson,
  exportProfileJson,
  importProfileJson,
} from '@/lib/profile';
import { importQueueItems, listQueue } from '@/lib/queue';
import { Button, StatusBanner } from '@/components/ui';

type BackupTabProps = {
  profile: Profile;
  onImport: (profile: Profile) => void;
  onReload: () => Promise<void>;
  disabled?: boolean;
};

export function BackupTab({ profile, onImport, onReload, disabled }: BackupTabProps) {
  const profileInputRef = useRef<HTMLInputElement>(null);
  const queueInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const handleExportProfile = () => {
    const json = exportProfileJson(profile);
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`applykit-profile-${date}.json`, json);
    setMessage({ text: 'Profile exported.', tone: 'success' });
  };

  const handleExportQueue = async () => {
    const items = await listQueue();
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`applykit-queue-${date}.csv`, queueToCsv(items));
    setMessage({ text: `Queue exported (${items.length} row(s)).`, tone: 'success' });
  };

  const handleExportAll = async () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`applykit-profile-${date}.json`, exportProfileJson(profile));
    const items = await listQueue();
    downloadCsv(`applykit-queue-${date}.csv`, queueToCsv(items));
    setMessage({ text: 'Profile JSON and queue CSV downloaded.', tone: 'success' });
  };

  const handleImportProfile = async (file: File) => {
    try {
      const text = await file.text();
      const imported = importProfileJson(text);
      onImport(imported);
      setMessage({ text: 'Profile imported. Click Save to persist changes.', tone: 'success' });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Import failed.',
        tone: 'error',
      });
    }
  };

  const handleImportQueue = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = csvToQueueItems(text);
      const result = await importQueueItems(parsed);
      setMessage({
        text: `Queue import: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
        tone: 'success',
      });
    } catch {
      setMessage({ text: 'Queue import failed. Check CSV format.', tone: 'error' });
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset profile to empty defaults? This cannot be undone unless you have a backup.')) {
      return;
    }
    await clearProfile();
    await onReload();
    setMessage({ text: 'Profile reset.', tone: 'success' });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Download profile JSON and mail queue CSV for backup. PDF resumes stay in local IndexedDB —
        re-upload after a fresh install if needed. Do not commit backups or PDFs to git.
      </p>

      {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Profile</h3>
        <div className="flex flex-wrap gap-3">
          <Button disabled={disabled} onClick={handleExportProfile}>
            Export profile JSON
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => profileInputRef.current?.click()}
          >
            Import profile JSON
          </Button>
          <Button variant="ghost" disabled={disabled} onClick={() => void handleReset()}>
            Reset profile
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Last saved: {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'Never'}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Mail queue</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={disabled} onClick={() => void handleExportQueue()}>
            Export queue CSV
          </Button>
          <Button variant="secondary" disabled={disabled} onClick={() => queueInputRef.current?.click()}>
            Import queue CSV
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Full backup</h3>
        <Button disabled={disabled} onClick={() => void handleExportAll()}>
          Download profile + queue
        </Button>
      </section>

      <input
        ref={profileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportProfile(file);
          e.target.value = '';
        }}
      />

      <input
        ref={queueInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportQueue(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
