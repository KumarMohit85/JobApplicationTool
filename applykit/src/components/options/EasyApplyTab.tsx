import type { Profile, YesNo } from '@/types/profile';
import { resolveYearsOfExperience } from '@/lib/profile';
import { Field, Select, TextInput } from '@/components/ui';

type EasyApplyTabProps = {
  profile: Profile;
  onChange: (updater: (prev: Profile) => Profile) => void;
  disabled?: boolean;
};

const yesNoOptions = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];

export function EasyApplyTab({ profile, onChange, disabled }: EasyApplyTabProps) {
  const defaults = profile.easyApplyDefaults;
  const computedYears = resolveYearsOfExperience(profile);

  const setDefault = <K extends keyof typeof defaults>(key: K, value: (typeof defaults)[K]) => {
    onChange((p) => ({
      ...p,
      easyApplyDefaults: { ...p.easyApplyDefaults, [key]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Defaults used when autofilling LinkedIn Easy Apply and ATS forms. You can always override on
        each application.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Authorized to work">
          <Select
            disabled={disabled}
            value={defaults.authorizedToWork}
            options={yesNoOptions}
            onChange={(v) => setDefault('authorizedToWork', v as YesNo)}
          />
        </Field>
        <Field label="Requires sponsorship">
          <Select
            disabled={disabled}
            value={defaults.requiresSponsorship}
            options={yesNoOptions}
            onChange={(v) => setDefault('requiresSponsorship', v as YesNo)}
          />
        </Field>
        <Field label="Willing to relocate">
          <Select
            disabled={disabled}
            value={defaults.willingToRelocate}
            options={yesNoOptions}
            onChange={(v) => setDefault('willingToRelocate', v as YesNo)}
          />
        </Field>
        <Field
          label="Years of experience"
          hint={
            computedYears != null && defaults.yearsOfExperience == null
              ? `Auto-calculated from experience: ${computedYears}`
              : 'Leave blank to auto-calculate from your work history.'
          }
        >
          <TextInput
            disabled={disabled}
            type="number"
            value={defaults.yearsOfExperience?.toString() ?? ''}
            placeholder={computedYears?.toString() ?? ''}
            onChange={(raw) => {
              const trimmed = raw.trim();
              setDefault(
                'yearsOfExperience',
                trimmed === '' ? undefined : Number.parseFloat(trimmed),
              );
            }}
          />
        </Field>
        <Field label="Notice period">
          <TextInput
            disabled={disabled}
            value={defaults.noticePeriod ?? ''}
            placeholder="Immediate"
            onChange={(noticePeriod) => setDefault('noticePeriod', noticePeriod)}
          />
        </Field>
        <Field label="Expected salary (optional)">
          <TextInput
            disabled={disabled}
            value={defaults.expectedSalary ?? ''}
            placeholder="Leave blank if you prefer not to answer"
            onChange={(expectedSalary) => setDefault('expectedSalary', expectedSalary)}
          />
        </Field>
        <Field label="Work / citizenship country">
          <TextInput
            disabled={disabled}
            value={defaults.workCountry ?? ''}
            placeholder="India"
            onChange={(workCountry) => setDefault('workCountry', workCountry)}
          />
        </Field>
        <Field label="Earliest start date">
          <TextInput
            disabled={disabled}
            value={defaults.earliestStartDate ?? ''}
            placeholder="YYYY-MM-DD or Immediate"
            onChange={(earliestStartDate) => setDefault('earliestStartDate', earliestStartDate)}
          />
        </Field>
        <Field label="Work arrangement">
          <Select
            disabled={disabled}
            value={defaults.workArrangement ?? ''}
            options={[
              { value: '', label: 'Not set' },
              { value: 'remote', label: 'Remote' },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'onsite', label: 'On-site' },
            ]}
            onChange={(v) => setDefault('workArrangement', v as typeof defaults.workArrangement)}
          />
        </Field>
        <Field label="How did you hear about us (default)">
          <TextInput
            disabled={disabled}
            value={defaults.howHeard ?? ''}
            placeholder="LinkedIn"
            onChange={(howHeard) => setDefault('howHeard', howHeard)}
          />
        </Field>
        <Field label="Know anyone at the company">
          <Select
            disabled={disabled}
            value={defaults.knowAnyoneAtCompany ?? 'No'}
            options={yesNoOptions}
            onChange={(v) => setDefault('knowAnyoneAtCompany', v as YesNo)}
          />
        </Field>
        <Field label="Visa type (if any)">
          <TextInput
            disabled={disabled}
            value={defaults.visaType ?? ''}
            placeholder="Leave blank if citizen / not applicable"
            onChange={(visaType) => setDefault('visaType', visaType)}
          />
        </Field>
        <Field label="Current company (override)">
          <TextInput
            disabled={disabled}
            value={defaults.currentCompany ?? ''}
            placeholder="Uses latest experience if blank"
            onChange={(currentCompany) => setDefault('currentCompany', currentCompany)}
          />
        </Field>
        <Field label="Current title (override)">
          <TextInput
            disabled={disabled}
            value={defaults.currentTitle ?? ''}
            placeholder="Uses latest experience if blank"
            onChange={(currentTitle) => setDefault('currentTitle', currentTitle)}
          />
        </Field>
        <Field label="EEO gender (default)">
          <TextInput
            disabled={disabled}
            value={defaults.eeoGender ?? ''}
            onChange={(eeoGender) => setDefault('eeoGender', eeoGender)}
          />
        </Field>
        <Field label="EEO race / ethnicity (default)">
          <TextInput
            disabled={disabled}
            value={defaults.eeoRace ?? ''}
            onChange={(eeoRace) => setDefault('eeoRace', eeoRace)}
          />
        </Field>
        <Field label="EEO veteran (default)">
          <TextInput
            disabled={disabled}
            value={defaults.eeoVeteran ?? ''}
            onChange={(eeoVeteran) => setDefault('eeoVeteran', eeoVeteran)}
          />
        </Field>
        <Field label="EEO disability (default)">
          <TextInput
            disabled={disabled}
            value={defaults.eeoDisability ?? ''}
            onChange={(eeoDisability) => setDefault('eeoDisability', eeoDisability)}
          />
        </Field>
      </div>
    </div>
  );
}
