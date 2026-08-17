import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useJobContext } from '@/hooks/useJobContext';
import { useSidePanelMatch } from '@/hooks/useSidePanelMatch';
import { ContextTab } from '@/components/sidepanel/ContextTab';
import { MatchTab } from '@/components/sidepanel/MatchTab';
import { CoverTab } from '@/components/sidepanel/CoverTab';
import { EmailTab } from '@/components/sidepanel/EmailTab';
import { SidePanelFooter } from '@/components/sidepanel/SidePanelFooter';
import { Button, StatusBanner } from '@/components/ui';

type PanelTab = 'context' | 'match' | 'cover' | 'email';

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'context', label: 'Context' },
  { id: 'match', label: 'Match' },
  { id: 'cover', label: 'Cover' },
  { id: 'email', label: 'Email' },
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
    <div className="flex min-h-screen flex-col p-4">
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">ApplyKit</h1>
          <p className="text-sm text-slate-600">Review job context, then act</p>
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
          </div>
        ) : null}

        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md px-2 py-2 text-xs font-medium ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
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

        <Button variant="secondary" onClick={openOptions}>
          Open profile settings
        </Button>
      </div>

      <div className="mt-auto pt-4">
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
