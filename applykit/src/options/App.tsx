import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { saveProfile } from '@/lib/profile';
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

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'personal', label: 'Personal', icon: '👤' },
  { id: 'skills', label: 'Skills', icon: '⚡' },
  { id: 'resumes', label: 'Resumes', icon: '📄' },
  { id: 'experience', label: 'Experience', icon: '💼' },
  { id: 'education', label: 'Education', icon: '🎓' },
  { id: 'easyApply', label: 'Easy Apply', icon: '⚙️' },
  { id: 'queue', label: 'Mail queue', icon: '📋' },
  { id: 'activity', label: 'Activity log', icon: '📊' },
  { id: 'backup', label: 'Backup', icon: '💾' },
  { id: 'ai', label: 'AI settings', icon: '✨' },
  { id: 'cloud', label: 'Cloud sync', icon: '☁️' },
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
      void chrome.runtime.sendMessage({ type: 'CLOUD_PUSH', profile });
    }
  };

  const disabled = loading || saving;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 shadow-md shadow-indigo-200/60 text-white font-black text-lg">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                ApplyKit <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">v0.2</span>
              </h1>
              <p className="text-xs text-slate-500">Smart Job Application & Cloud Sync Suite</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            ) : null}
            <Button disabled={disabled || !dirty} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {loading ? (
          <StatusBanner message="Loading profile settings…" tone="info" />
        ) : (
          <div className="space-y-6">
            {error ? <StatusBanner message={error} tone="error" /> : null}
            {saveMessage ? <StatusBanner message={saveMessage} tone="success" /> : null}

            {/* Navigation Tabs */}
            <nav className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm shadow-indigo-200'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Section Card */}
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
                  onProfilePulled={async (pulled) => {
                    await saveProfile(pulled);
                    await reload();
                    setSaveMessage('Profile & resumes pulled from cloud and saved successfully!');
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
