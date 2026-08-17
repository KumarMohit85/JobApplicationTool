import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { PersonalTab } from '@/components/options/PersonalTab';
import { SkillsTab } from '@/components/options/SkillsTab';
import { ResumesTab } from '@/components/options/ResumesTab';
import { ExperienceTab } from '@/components/options/ExperienceTab';
import { EducationTab } from '@/components/options/EducationTab';
import { EasyApplyTab } from '@/components/options/EasyApplyTab';
import { ActivityLogTab } from '@/components/options/ActivityLogTab';
import { BackupTab } from '@/components/options/BackupTab';
import { QueueTab } from '@/components/options/QueueTab';
import { AiSettingsTab } from '@/components/options/AiSettingsTab';
import { CloudSyncTab } from '@/components/options/CloudSyncTab';
import { Button, SectionCard, StatusBanner } from '@/components/ui';

type TabId =
  | 'personal'
  | 'skills'
  | 'resumes'
  | 'experience'
  | 'education'
  | 'easyApply'
  | 'queue'
  | 'activity'
  | 'backup'
  | 'ai'
  | 'cloud';

const tabs: { id: TabId; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'skills', label: 'Skills' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'easyApply', label: 'Easy Apply defaults' },
  { id: 'queue', label: 'Mail queue' },
  { id: 'activity', label: 'Activity log' },
  { id: 'backup', label: 'Backup' },
  { id: 'ai', label: '✨ AI settings' },
  { id: 'cloud', label: '☁️ Cloud sync' },
];

export default function OptionsApp() {
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { profile, loading, saving, error, dirty, setProfile, reload, persist, markDirty } =
    useProfile();

  const handleChange = (updater: (prev: typeof profile) => typeof profile) => {
    setProfile(updater);
    markDirty();
    setSaveMessage(null);
  };

  const handleSave = async () => {
    const ok = await persist();
    if (ok) {
      setSaveMessage('Profile saved successfully.');
    }
  };

  const disabled = loading || saving;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">ApplyKit Settings</h1>
            <p className="text-sm text-slate-600">Manage your profile for autofill and applications.</p>
          </div>
          <div className="flex items-center gap-3">
            {dirty ? (
              <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
            ) : null}
            <Button disabled={disabled || !dirty} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        {loading ? (
          <StatusBanner message="Loading profile…" tone="info" />
        ) : (
          <div className="space-y-4">
            {error ? <StatusBanner message={error} tone="error" /> : null}
            {saveMessage ? <StatusBanner message={saveMessage} tone="success" /> : null}

            <nav className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <SectionCard title={tabs.find((t) => t.id === activeTab)?.label ?? 'Profile'}>
              {activeTab === 'personal' ? (
                <PersonalTab profile={profile} onChange={handleChange} disabled={disabled} />
              ) : null}
              {activeTab === 'skills' ? (
                <SkillsTab profile={profile} onChange={handleChange} disabled={disabled} />
              ) : null}
              {activeTab === 'resumes' ? <ResumesTab disabled={disabled} /> : null}
              {activeTab === 'experience' ? (
                <ExperienceTab profile={profile} onChange={handleChange} disabled={disabled} />
              ) : null}
              {activeTab === 'education' ? (
                <EducationTab profile={profile} onChange={handleChange} disabled={disabled} />
              ) : null}
              {activeTab === 'easyApply' ? (
                <EasyApplyTab profile={profile} onChange={handleChange} disabled={disabled} />
              ) : null}
              {activeTab === 'queue' ? <QueueTab /> : null}
              {activeTab === 'activity' ? <ActivityLogTab /> : null}
              {activeTab === 'backup' ? (
                <BackupTab
                  profile={profile}
                  disabled={disabled}
                  onReload={reload}
                  onImport={(imported) => {
                    setProfile(imported);
                    markDirty();
                  }}
                />
              ) : null}
              {activeTab === 'ai' ? <AiSettingsTab /> : null}
              {activeTab === 'cloud' ? (
                <CloudSyncTab
                  profile={profile}
                  onProfilePulled={(pulled) => {
                    setProfile(pulled);
                    markDirty();
                    setSaveMessage('Profile pulled from cloud — click Save to persist.');
                  }}
                />
              ) : null}
            </SectionCard>
          </div>
        )}
      </main>
    </div>
  );
}
