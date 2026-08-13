import type { Education, Profile } from '@/types/profile';
import { createId } from '@/lib/id';
import { Button, Field, TextInput } from '@/components/ui';

type EducationTabProps = {
  profile: Profile;
  onChange: (updater: (prev: Profile) => Profile) => void;
  disabled?: boolean;
};

function emptyEducation(): Education {
  return {
    id: createId(),
    school: '',
    degree: '',
    year: '',
  };
}

export function EducationTab({ profile, onChange, disabled }: EducationTabProps) {
  const updateEntry = (id: string, patch: Partial<Education>) => {
    onChange((p) => ({
      ...p,
      education: p.education.map((edu) => (edu.id === id ? { ...edu, ...patch } : edu)),
    }));
  };

  const addEntry = () => {
    onChange((p) => ({ ...p, education: [...p.education, emptyEducation()] }));
  };

  const removeEntry = (id: string) => {
    onChange((p) => ({ ...p, education: p.education.filter((edu) => edu.id !== id) }));
  };

  return (
    <div className="space-y-6">
      {profile.education.length === 0 ? (
        <p className="text-sm text-slate-600">No education entries yet.</p>
      ) : null}

      {profile.education.map((edu, index) => (
        <div key={edu.id} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900">Entry {index + 1}</h3>
            <Button variant="ghost" disabled={disabled} onClick={() => removeEntry(edu.id)}>
              Remove
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="School">
              <TextInput
                disabled={disabled}
                value={edu.school}
                onChange={(school) => updateEntry(edu.id, { school })}
              />
            </Field>
            <Field label="Degree">
              <TextInput
                disabled={disabled}
                value={edu.degree}
                onChange={(degree) => updateEntry(edu.id, { degree })}
              />
            </Field>
            <Field label="Year">
              <TextInput
                disabled={disabled}
                value={edu.year}
                placeholder="2024"
                onChange={(year) => updateEntry(edu.id, { year })}
              />
            </Field>
          </div>
        </div>
      ))}

      <Button variant="secondary" disabled={disabled} onClick={addEntry}>
        Add education
      </Button>
    </div>
  );
}
