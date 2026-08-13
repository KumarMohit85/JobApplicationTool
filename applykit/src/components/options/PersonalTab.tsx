import type { Profile, PersonalInfo } from '@/types/profile';
import { Field, TextArea, TextInput } from '@/components/ui';

type PersonalTabProps = {
  profile: Profile;
  onChange: (updater: (prev: Profile) => Profile) => void;
  disabled?: boolean;
};

function updatePersonal(profile: Profile, patch: Partial<PersonalInfo>): Profile {
  const personal = { ...profile.personal, ...patch };
  if (patch.fullName !== undefined) {
    const parts = patch.fullName.trim().split(/\s+/).filter(Boolean);
    personal.firstName = parts[0] ?? '';
    personal.lastName = parts.slice(1).join(' ');
  } else if (patch.firstName !== undefined || patch.lastName !== undefined) {
    personal.fullName = [personal.firstName, personal.lastName].filter(Boolean).join(' ');
  }
  return { ...profile, personal };
}

export function PersonalTab({ profile, onChange, disabled }: PersonalTabProps) {
  const { personal } = profile;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <TextInput
            disabled={disabled}
            value={personal.fullName}
            placeholder="Jane Doe"
            onChange={(fullName) => onChange((p) => updatePersonal(p, { fullName }))}
          />
        </Field>
        <Field label="Headline">
          <TextInput
            disabled={disabled}
            value={personal.headline}
            placeholder="Senior Software Engineer"
            onChange={(headline) => onChange((p) => updatePersonal(p, { headline }))}
          />
        </Field>
        <Field label="Email">
          <TextInput
            disabled={disabled}
            type="email"
            value={personal.email}
            placeholder="you@email.com"
            onChange={(email) => onChange((p) => updatePersonal(p, { email }))}
          />
        </Field>
        <Field label="Phone">
          <TextInput
            disabled={disabled}
            type="tel"
            value={personal.phone}
            placeholder="+1 555 0100"
            onChange={(phone) => onChange((p) => updatePersonal(p, { phone }))}
          />
        </Field>
        <Field label="Location">
          <TextInput
            disabled={disabled}
            value={personal.location}
            placeholder="City, Country"
            onChange={(location) => onChange((p) => updatePersonal(p, { location }))}
          />
        </Field>
        <Field label="LinkedIn URL">
          <TextInput
            disabled={disabled}
            type="url"
            value={personal.linkedIn}
            placeholder="https://linkedin.com/in/you"
            onChange={(linkedIn) => onChange((p) => updatePersonal(p, { linkedIn }))}
          />
        </Field>
        <Field label="GitHub URL">
          <TextInput
            disabled={disabled}
            type="url"
            value={personal.github}
            placeholder="https://github.com/you"
            onChange={(github) => onChange((p) => updatePersonal(p, { github }))}
          />
        </Field>
        <Field label="Portfolio / website">
          <TextInput
            disabled={disabled}
            type="url"
            value={personal.portfolio}
            placeholder="https://yoursite.com"
            onChange={(portfolio) => onChange((p) => updatePersonal(p, { portfolio }))}
          />
        </Field>
      </div>

      <Field label="Professional summary" hint="Used in cover letters and email bodies.">
        <TextArea
          disabled={disabled}
          rows={5}
          value={profile.summary}
          placeholder="Brief overview of your experience and strengths..."
          onChange={(summary) => onChange((p) => ({ ...p, summary }))}
        />
      </Field>
    </div>
  );
}
