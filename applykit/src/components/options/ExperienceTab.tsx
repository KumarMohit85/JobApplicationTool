import type { Experience, Profile } from '@/types/profile';
import { createId } from '@/lib/id';
import { Button, Field, TextArea, TextInput } from '@/components/ui';

type ExperienceTabProps = {
  profile: Profile;
  onChange: (updater: (prev: Profile) => Profile) => void;
  disabled?: boolean;
};

function emptyExperience(): Experience {
  return {
    id: createId(),
    company: '',
    title: '',
    startDate: '',
    endDate: 'present',
    bullets: [''],
    technologies: [],
  };
}

export function ExperienceTab({ profile, onChange, disabled }: ExperienceTabProps) {
  const updateEntry = (id: string, patch: Partial<Experience>) => {
    onChange((p) => ({
      ...p,
      experience: p.experience.map((exp) => (exp.id === id ? { ...exp, ...patch } : exp)),
    }));
  };

  const addEntry = () => {
    onChange((p) => ({ ...p, experience: [...p.experience, emptyExperience()] }));
  };

  const removeEntry = (id: string) => {
    onChange((p) => ({ ...p, experience: p.experience.filter((exp) => exp.id !== id) }));
  };

  const updateBullet = (expId: string, index: number, value: string) => {
    onChange((p) => ({
      ...p,
      experience: p.experience.map((exp) => {
        if (exp.id !== expId) return exp;
        const bullets = [...exp.bullets];
        bullets[index] = value;
        return { ...exp, bullets };
      }),
    }));
  };

  const addBullet = (expId: string) => {
    onChange((p) => ({
      ...p,
      experience: p.experience.map((exp) =>
        exp.id === expId ? { ...exp, bullets: [...exp.bullets, ''] } : exp,
      ),
    }));
  };

  const updateTechnologies = (expId: string, raw: string) => {
    const technologies = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    updateEntry(expId, { technologies });
  };

  return (
    <div className="space-y-6">
      {profile.experience.length === 0 ? (
        <p className="text-sm text-slate-600">No experience added yet.</p>
      ) : null}

      {profile.experience.map((exp, index) => (
        <div key={exp.id} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900">Role {index + 1}</h3>
            <Button variant="ghost" disabled={disabled} onClick={() => removeEntry(exp.id)}>
              Remove
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <TextInput
                disabled={disabled}
                value={exp.company}
                onChange={(company) => updateEntry(exp.id, { company })}
              />
            </Field>
            <Field label="Job title">
              <TextInput
                disabled={disabled}
                value={exp.title}
                onChange={(title) => updateEntry(exp.id, { title })}
              />
            </Field>
            <Field label="Start date" hint="YYYY-MM">
              <TextInput
                disabled={disabled}
                value={exp.startDate}
                placeholder="2022-01"
                onChange={(startDate) => updateEntry(exp.id, { startDate })}
              />
            </Field>
            <Field label="End date" hint="YYYY-MM or leave as present">
              <TextInput
                disabled={disabled}
                value={exp.endDate === 'present' ? '' : exp.endDate}
                placeholder="present"
                onChange={(endDate) =>
                  updateEntry(exp.id, {
                    endDate: endDate.trim() === '' ? 'present' : endDate,
                  })
                }
              />
            </Field>
          </div>

          <Field label="Technologies" hint="Comma-separated">
            <TextInput
              disabled={disabled}
              value={exp.technologies.join(', ')}
              onChange={(raw) => updateTechnologies(exp.id, raw)}
            />
          </Field>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Bullet points</span>
            {exp.bullets.map((bullet, bulletIndex) => (
              <TextArea
                key={`${exp.id}-bullet-${bulletIndex}`}
                disabled={disabled}
                rows={2}
                value={bullet}
                onChange={(value) => updateBullet(exp.id, bulletIndex, value)}
              />
            ))}
            <Button variant="secondary" disabled={disabled} onClick={() => addBullet(exp.id)}>
              Add bullet
            </Button>
          </div>
        </div>
      ))}

      <Button variant="secondary" disabled={disabled} onClick={addEntry}>
        Add experience
      </Button>
    </div>
  );
}
