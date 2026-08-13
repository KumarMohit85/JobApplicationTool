import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResumeVariant } from '@/types/resume';
import {
  createEmptyResume,
  deleteResume,
  downloadResumePdf,
  formatListField,
  listResumes,
  parseListField,
  saveResume,
} from '@/lib/resumes';
import { rankResumes } from '@/lib/matcher';
import { Button, Field, SectionCard, StatusBanner, TextArea, TextInput } from '@/components/ui';

export function ResumesTab({ disabled }: { disabled?: boolean }) {
  const [resumes, setResumes] = useState<ResumeVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<ResumeVariant | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [testJd, setTestJd] = useState('');
  const [testRole, setTestRole] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResumes(await listResumes());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resumes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rankings = useMemo(() => {
    if (!testJd.trim() || resumes.length === 0) return [];
    return rankResumes(resumes, testJd, testRole);
  }, [resumes, testJd, testRole]);

  const startNew = () => {
    setEditing(createEmptyResume());
    setPendingFile(null);
    setMessage(null);
  };

  const startEdit = (resume: ResumeVariant) => {
    setEditing({ ...resume });
    setPendingFile(null);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setPendingFile(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.fileName && !pendingFile) {
      setError('Please upload a PDF file for this resume.');
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const saved = await saveResume(editing, pendingFile);
      setMessage(`Saved "${saved.name}".`);
      setEditing(null);
      setPendingFile(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save resume.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this resume and its PDF?')) return;
    setError(null);
    try {
      await deleteResume(id);
      if (editing?.id === id) cancelEdit();
      await reload();
      setMessage('Resume deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete resume.');
    }
  };

  const handleDownload = async (resume: ResumeVariant) => {
    setError(null);
    try {
      await downloadResumePdf(resume);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  if (loading) {
    return <StatusBanner message="Loading resumes…" tone="info" />;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Upload multiple PDF resumes. Each variant needs a short description of what it is for — used
        to pick the right resume for each job.
      </p>

      {error ? <StatusBanner message={error} tone="error" /> : null}
      {message ? <StatusBanner message={message} tone="success" /> : null}

      <Button variant="secondary" disabled={disabled} onClick={startNew}>
        Add resume variant
      </Button>

      {resumes.length === 0 ? (
        <p className="text-sm text-slate-500">No resumes uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {resumes.map((resume) => (
            <li
              key={resume.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">{resume.name}</p>
                <p className="text-xs text-slate-500">
                  {resume.fileName || 'No PDF attached'} · priority {resume.priority}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" disabled={disabled} onClick={() => startEdit(resume)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  disabled={disabled || !resume.fileName}
                  onClick={() => void handleDownload(resume)}
                >
                  Download PDF
                </Button>
                <Button variant="ghost" disabled={disabled} onClick={() => void handleDelete(resume.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <SectionCard title={editing.name ? `Edit: ${editing.name}` : 'New resume variant'}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name" hint='e.g. "Full Stack – 2024"'>
                <TextInput
                  disabled={disabled}
                  value={editing.name}
                  onChange={(name) => setEditing({ ...editing, name })}
                />
              </Field>
              <Field label="Priority" hint="Higher wins ties when scores are equal (default 1)">
                <TextInput
                  disabled={disabled}
                  type="number"
                  value={String(editing.priority)}
                  onChange={(raw) =>
                    setEditing({
                      ...editing,
                      priority: Number.parseInt(raw, 10) || 1,
                    })
                  }
                />
              </Field>
            </div>

            <Field
              label="What this resume is about"
              hint="Describe focus, strengths, and ideal roles — used for matching."
            >
              <TextArea
                disabled={disabled}
                rows={4}
                value={editing.description}
                placeholder="Full-stack engineer focused on React/Node… best for startup full-stack roles."
                onChange={(description) => setEditing({ ...editing, description })}
              />
            </Field>

            <Field label="Skills" hint="Comma-separated">
              <TextInput
                disabled={disabled}
                value={formatListField(editing.skills)}
                onChange={(raw) => setEditing({ ...editing, skills: parseListField(raw) })}
              />
            </Field>

            <Field label="Keywords" hint="Comma-separated (e.g. full stack, mern, backend)">
              <TextInput
                disabled={disabled}
                value={formatListField(editing.keywords)}
                onChange={(raw) => setEditing({ ...editing, keywords: parseListField(raw) })}
              />
            </Field>

            <Field label="Target roles" hint="Comma-separated job titles this resume fits">
              <TextInput
                disabled={disabled}
                value={formatListField(editing.targetRoles)}
                onChange={(raw) => setEditing({ ...editing, targetRoles: parseListField(raw) })}
              />
            </Field>

            <Field label="PDF file">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {pendingFile ? 'Change PDF' : editing.fileName ? 'Replace PDF' : 'Upload PDF'}
                </Button>
                <span className="text-sm text-slate-600">
                  {pendingFile?.name ?? editing.fileName ?? 'No file selected'}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPendingFile(file);
                  e.target.value = '';
                }}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button disabled={disabled} onClick={() => void handleSave()}>
                Save resume
              </Button>
              <Button variant="ghost" disabled={disabled} onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {resumes.length > 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Test resume match</h3>
          <div className="space-y-3">
            <Field label="Role (optional)">
              <TextInput
                disabled={disabled}
                value={testRole}
                placeholder="Senior Frontend Engineer"
                onChange={setTestRole}
              />
            </Field>
            <Field label="Job description">
              <TextArea
                disabled={disabled}
                rows={4}
                value={testJd}
                placeholder="Paste job description…"
                onChange={setTestJd}
              />
            </Field>
            {rankings.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {rankings.map((item, index) => (
                  <li key={item.resume.id} className="text-slate-700">
                    {index + 1}. {item.resume.name} — {item.confidence}% match
                    {index === 0 ? ' (recommended)' : ''}
                  </li>
                ))}
              </ul>
            ) : testJd.trim() ? (
              <p className="text-sm text-slate-500">No strong match — add more keywords or description text.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
