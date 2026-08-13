import type { Profile, Skill, SkillLevel } from '@/types/profile';
import { createEmptySkill, formatKeywordList, normalizeSkills, parseKeywordList, suggestSkillsFromTechnologies } from '@/lib/skills';
import { createId } from '@/lib/id';
import { matchSkills } from '@/lib/matcher';
import { Button, Field, Select, TextArea, TextInput } from '@/components/ui';
import { useMemo, useState } from 'react';

type SkillsTabProps = {
  profile: Profile;
  onChange: (updater: (prev: Profile) => Profile) => void;
  disabled?: boolean;
};

const levelOptions = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

export function SkillsTab({ profile, onChange, disabled }: SkillsTabProps) {
  const [testJd, setTestJd] = useState('');

  const testResult = useMemo(() => {
    if (!testJd.trim() || profile.skills.length === 0) return null;
    return matchSkills(profile.skills, testJd);
  }, [profile.skills, testJd]);

  const updateSkill = (id: string, patch: Partial<Skill>) => {
    onChange((p) => ({
      ...p,
      skills: normalizeSkills(
        p.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      ),
    }));
  };

  const addSkill = () => {
    onChange((p) => ({ ...p, skills: [...p.skills, createEmptySkill()] }));
  };

  const removeSkill = (id: string) => {
    onChange((p) => ({ ...p, skills: p.skills.filter((s) => s.id !== id) }));
  };

  const importFromExperience = () => {
    const techs = profile.experience.flatMap((exp) => exp.technologies);
    const suggestions = suggestSkillsFromTechnologies(techs);
    if (suggestions.length === 0) return;

    const existing = new Set(profile.skills.map((s) => s.name.toLowerCase()));
    const toAdd: Skill[] = suggestions
      .filter((name) => !existing.has(name.toLowerCase()))
      .map((name) => ({
        id: createId(),
        name,
        level: 'intermediate' as SkillLevel,
        keywords: parseKeywordList(name),
      }));

    if (toAdd.length === 0) return;
    onChange((p) => ({ ...p, skills: normalizeSkills([...p.skills, ...toAdd]) }));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Add skills with proficiency levels and extra keywords. These are used later to match job
        descriptions and tailor applications.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={disabled} onClick={addSkill}>
          Add skill
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={importFromExperience}>
          Import from experience technologies
        </Button>
      </div>

      {profile.skills.length === 0 ? (
        <p className="text-sm text-slate-500">No skills yet. Add one or import from experience.</p>
      ) : null}

      {profile.skills.map((skill, index) => (
        <div key={skill.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900">Skill {index + 1}</h3>
            <Button variant="ghost" disabled={disabled} onClick={() => removeSkill(skill.id)}>
              Remove
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Skill name">
              <TextInput
                disabled={disabled}
                value={skill.name}
                placeholder="React"
                onChange={(name) => updateSkill(skill.id, { name })}
              />
            </Field>
            <Field label="Proficiency">
              <Select
                disabled={disabled}
                value={skill.level}
                options={levelOptions}
                onChange={(level) => updateSkill(skill.id, { level: level as SkillLevel })}
              />
            </Field>
          </div>

          <Field
            label="Keywords"
            hint="Comma-separated aliases (e.g. reactjs, frontend, react.js). Skill name is always included."
          >
            <TextInput
              disabled={disabled}
              value={formatKeywordList(skill.keywords.filter((k) => k !== skill.name.toLowerCase()))}
              placeholder="reactjs, frontend"
              onChange={(raw) =>
                updateSkill(skill.id, {
                  keywords: parseKeywordList(`${skill.name}, ${raw}`),
                })
              }
            />
          </Field>
        </div>
      ))}

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Test skill match</h3>
        <p className="mb-3 text-xs text-slate-600">
          Paste a job description snippet to preview which skills would match (full generator comes in
          a later feature).
        </p>
        <TextArea
          disabled={disabled}
          rows={4}
          value={testJd}
          placeholder="Paste job description here…"
          onChange={setTestJd}
        />
        {testResult ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="font-medium text-slate-800">Match score: {testResult.score}%</p>
            {testResult.matched.length > 0 ? (
              <p className="text-green-700">
                Matched:{' '}
                {testResult.matched.map((m) => `${m.skill.name} (${m.skill.level})`).join(', ')}
              </p>
            ) : (
              <p className="text-amber-700">No skills matched this snippet.</p>
            )}
            {testResult.missing.length > 0 ? (
              <p className="text-slate-600">Not found in JD: {testResult.missing.join(', ')}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
