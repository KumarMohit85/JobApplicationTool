import { RESUMES_STORAGE_KEY, type ResumeVariant } from '@/types/resume';
import { createId } from '@/lib/id';
import { parseKeywordList } from '@/lib/skills';
import { deleteBlob, getBlob, putBlob } from '@/lib/db';

export function createEmptyResume(): ResumeVariant {
  const id = createId();
  return {
    id,
    name: '',
    fileName: '',
    blobKey: `resume-blob-${id}`,
    description: '',
    skills: [],
    keywords: [],
    targetRoles: [],
    priority: 1,
    uploadedAt: new Date().toISOString(),
  };
}

function normalizeResume(input: Partial<ResumeVariant>): ResumeVariant | null {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return null;

  const id = typeof input.id === 'string' && input.id ? input.id : createId();
  const skills = Array.isArray(input.skills)
    ? parseKeywordList(input.skills.map(String).join(', '))
    : [];
  const keywords = Array.isArray(input.keywords)
    ? parseKeywordList(input.keywords.map(String).join(', '))
    : [];
  const targetRoles = Array.isArray(input.targetRoles)
    ? input.targetRoles.map((r) => String(r).trim()).filter(Boolean)
    : [];

  return {
    id,
    name,
    fileName: typeof input.fileName === 'string' ? input.fileName : '',
    blobKey: typeof input.blobKey === 'string' && input.blobKey ? input.blobKey : `resume-blob-${id}`,
    description: typeof input.description === 'string' ? input.description : '',
    skills,
    keywords,
    targetRoles,
    priority:
      typeof input.priority === 'number' && Number.isFinite(input.priority) ? input.priority : 1,
    uploadedAt:
      typeof input.uploadedAt === 'string' ? input.uploadedAt : new Date().toISOString(),
  };
}

function normalizeResumeList(input: unknown): ResumeVariant[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeResume(item as Partial<ResumeVariant>))
    .filter((r): r is ResumeVariant => r != null);
}

export async function listResumes(): Promise<ResumeVariant[]> {
  const result = await chrome.storage.local.get(RESUMES_STORAGE_KEY);
  return normalizeResumeList(result[RESUMES_STORAGE_KEY]);
}

async function saveResumeList(resumes: ResumeVariant[]): Promise<ResumeVariant[]> {
  const normalized = normalizeResumeList(resumes);
  await chrome.storage.local.set({ [RESUMES_STORAGE_KEY]: normalized });
  return normalized;
}

export async function saveResume(
  resume: ResumeVariant,
  pdfFile?: File | null,
): Promise<ResumeVariant> {
  const normalized = normalizeResume(resume);
  if (!normalized) {
    throw new Error('Resume name is required.');
  }

  if (pdfFile) {
    if (pdfFile.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported.');
    }
    await putBlob(normalized.blobKey, pdfFile);
    normalized.fileName = pdfFile.name;
    normalized.uploadedAt = new Date().toISOString();
  }

  const existing = await listResumes();
  const index = existing.findIndex((r) => r.id === normalized.id);
  const next = [...existing];
  if (index >= 0) {
    next[index] = { ...existing[index], ...normalized };
  } else {
    next.push(normalized);
  }

  const saved = await saveResumeList(next);
  const savedResume = saved.find((r) => r.id === normalized.id);
  if (!savedResume) {
    throw new Error('Failed to save resume.');
  }
  return savedResume;
}

export async function deleteResume(id: string): Promise<void> {
  const existing = await listResumes();
  const target = existing.find((r) => r.id === id);
  if (!target) return;

  await deleteBlob(target.blobKey);
  await saveResumeList(existing.filter((r) => r.id !== id));
}

export async function getResumePdfBlob(resume: ResumeVariant): Promise<Blob | null> {
  return getBlob(resume.blobKey);
}

export async function downloadResumePdf(resume: ResumeVariant): Promise<void> {
  const blob = await getResumePdfBlob(resume);
  if (!blob) {
    throw new Error('No PDF file stored for this resume.');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = resume.fileName || `${resume.name.replace(/\s+/g, '_')}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseListField(raw: string): string[] {
  return raw
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatListField(items: string[]): string {
  return items.join(', ');
}
