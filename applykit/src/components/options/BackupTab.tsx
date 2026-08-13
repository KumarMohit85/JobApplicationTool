import { useRef, useState } from 'react';
import type { Profile } from '@/types/profile';
import {
  clearProfile,
  downloadJson,
  exportProfileJson,
  importProfileJson,
} from '@/lib/profile';
import { Button, StatusBanner } from '@/components/ui';

type BackupTabProps = {
  profile: Profile;
  onImport: (profile: Profile) => void;
  onReload: () => Promise<void>;
  disabled?: boolean;
};

export function BackupTab({ profile, onImport, onReload, disabled }: BackupTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const handleExport = () => {
    const json = exportProfileJson(profile);
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`applykit-profile-${date}.json`, json);
    setMessage({ text: 'Profile exported.', tone: 'success' });
  };

  const handleImportFile = async (file: File) => {
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

  const handleReset = async () => {
    if (!window.confirm('Reset profile to empty defaults? This cannot be undone unless you have a backup.')) {
      return;
    }
    await clearProfile();
    await onReload();
    setMessage({ text: 'Profile reset.', tone: 'success' });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Export your profile as JSON for backup. Import restores fields into the editor — click Save
        after importing.
      </p>

      {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

      <div className="flex flex-wrap gap-3">
        <Button disabled={disabled} onClick={handleExport}>
          Export JSON
        </Button>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={() => void handleReset()}>
          Reset profile
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = '';
        }}
      />

      <p className="text-xs text-slate-500">
        Last saved: {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'Never'}
      </p>
    </div>
  );
}
