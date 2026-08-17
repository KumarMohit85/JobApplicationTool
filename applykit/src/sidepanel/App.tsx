import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useJobContext } from '@/hooks/useJobContext';
import { useSidePanelMatch } from '@/hooks/useSidePanelMatch';
import { ContextTab } from '@/components/sidepanel/ContextTab';
import { MatchTab } from '@/components/sidepanel/MatchTab';
import { CoverTab } from '@/components/sidepanel/CoverTab';
import { EmailTab } from '@/components/sidepanel/EmailTab';
import { SidePanelFooter } from '@/components/sidepanel/SidePanelFooter';
import { StatusBanner } from '@/components/ui';

type PanelTab = 'context' | 'match' | 'cover' | 'email';

const TABS: { id: PanelTab; label: string; icon: string }[] = [
  { id: 'context', label: 'Context', icon: '🎯' },
  { id: 'match', label: 'Match', icon: '⚡' },
  { id: 'cover', label: 'Cover', icon: '📝' },
  { id: 'email', label: 'Email', icon: '📧' },
];

export default function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<PanelTab>('context');
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const {
    context,
    loading: jobLoading,
    error: jobError,
    refresh,
    appendSelection,
  } = useJobContext(true);

  const {
    resumes,
    selectedResumeId,
    setSelectedResumeId,
    selectedResume,
    skillMatch,
    resumeMatch,
    generated,
  } = useSidePanelMatch(context, profile);

  const [coverDraft, setCoverDraft] = useState('');
  const coverLetterForAutofill = coverDraft || generated?.coverLetter;

  const matchedSkillNames = skillMatch?.matched.map((m) => m.skill.name) ?? [];

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased p-3.5 selection:bg-indigo-500 selection:text-white">
      <div className="space-y-3.5">
        {/* Modern Sidepanel Header */}
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 p-3.5 text-white shadow-md shadow-indigo-200/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs font-black text-white text-base">
              A
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">ApplyKit</h1>
              <p className="text-xs text-indigo-100/90">Smart Job Copilot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openOptions}
            title="Open Settings"
            className="rounded-xl bg-white/15 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/25 transition-all"
          >
            ⚙️ Settings
          </button>
        </div>

        {profileLoading ? <StatusBanner message="Loading profile…" tone="info" /> : null}
        {profileError ? <StatusBanner message={profileError} tone="error" /> : null}

        {!profileLoading && !profile.personal.fullName ? (
          <StatusBanner
            message="Complete profile in settings to enable matching & autofill."
            tone="info"
          />
        ) : null}

        {!profileLoading && profile.personal.fullName ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-xs font-bold text-white shadow-xs">
              {profile.personal.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">{profile.personal.fullName}</p>
              <p className="truncate text-xs text-slate-500">{profile.personal.headline || profile.personal.email}</p>
            </div>
          </div>
        ) : null}

        {/* Tab Navigation */}
        <nav className="flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {activeTab === 'context' ? (
          <ContextTab
            context={context}
            loading={jobLoading}
            error={jobError}
            onRefresh={refresh}
            onAppendSelection={appendSelection}
          />
        ) : null}

        {activeTab === 'match' ? (
          <MatchTab
            contextDescription={context?.description}
            skillMatch={skillMatch}
            resumeMatch={resumeMatch}
            resumes={resumes}
            selectedResumeId={selectedResumeId}
            onSelectResume={setSelectedResumeId}
            context={context}
            profile={profile}
            matchedSkillNames={matchedSkillNames}
          />
        ) : null}

        {activeTab === 'cover' ? (
          <CoverTab
            generated={generated}
            hasContext={Boolean(context)}
            draft={coverDraft}
            onDraftChange={setCoverDraft}
            context={context}
            profile={profile}
            selectedResumeId={selectedResumeId}
            resumes={resumes}
            matchedSkillNames={matchedSkillNames}
          />
        ) : null}

        {activeTab === 'email' ? (
          <EmailTab
            generated={generated}
            hasContext={Boolean(context)}
            context={context}
            profile={profile}
            selectedResumeId={selectedResumeId}
            resumes={resumes}
            matchedSkillNames={matchedSkillNames}
          />
        ) : null}
      </div>

      <div className="mt-auto pt-3.5">
        <SidePanelFooter
          context={context}
          profile={profile}
          selectedResume={selectedResume}
          coverLetter={coverLetterForAutofill}
        />
      </div>
    </div>
  );
}
