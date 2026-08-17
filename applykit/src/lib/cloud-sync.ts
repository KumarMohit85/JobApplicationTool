import { normalizeProfile } from '@/lib/profile';
import type { Profile } from '@/types/profile';
import type { ResumeVariant } from '@/types/resume';
import { RESUMES_STORAGE_KEY } from '@/types/resume';
import { listResumes, getResumePdfBlob } from '@/lib/resumes';
import { putBlob } from '@/lib/db';

const GIST_API = 'https://api.github.com/gists';
const GIST_PROFILE_FILE = 'applykit-profile.json';
const GIST_RESUMES_FILE = 'applykit-resumes.json';

// ─── Base64 Helpers ──────────────────────────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read blob as Base64.'));
      reader.readAsDataURL(blob);
    });
  }

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType = 'application/pdf'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export type GistResumePackage = ResumeVariant & {
  base64Pdf?: string | null;
};

// ─── Auto-Discover Existing Gist ──────────────────────────────────────────────

/**
 * Search user's GitHub Gists for an existing Gist containing applykit-profile.json.
 * Prevents creating duplicate Gists on extension reinstall or multi-device setup.
 */
export async function findExistingApplyKitGist(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${GIST_API}?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) return null;

    const gists = (await response.json()) as Array<{
      id: string;
      updated_at?: string;
      files?: Record<string, { raw_url?: string; size?: number }>;
    }>;

    const matchingGists = gists.filter(
      (g) => g.files && GIST_PROFILE_FILE in g.files,
    );

    if (matchingGists.length === 0) return null;

    // Sort by updated_at descending
    matchingGists.sort((a, b) => {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return timeB - timeA;
    });

    return matchingGists[0].id;
  } catch (err) {
    console.warn('Failed to discover existing Gist:', err);
    return null;
  }
}

// ─── GitHub Gist ──────────────────────────────────────────────────────────────

/**
 * Push profile JSON + Resume PDFs (Base64) to a GitHub Gist.
 * Guard: Refuses to overwrite an existing Gist if the local profile is empty.
 */
export async function pushProfileToGist(
  profile: Profile,
  token: string,
  gistId?: string,
): Promise<string> {
  const isEmptyProfile =
    !profile.personal.fullName.trim() && !profile.personal.email.trim();

  let targetGistId = gistId?.trim();

  // If no Gist ID stored, check if the user already has an ApplyKit Gist on GitHub
  if (!targetGistId) {
    const existing = await findExistingApplyKitGist(token);
    if (existing) {
      targetGistId = existing;
    }
  }

  // SAFETY GUARD: Refuse to overwrite an existing cloud backup with an empty local profile!
  if (isEmptyProfile && targetGistId) {
    throw new Error(
      'Cannot push an empty profile over an existing cloud backup. Please fill in your profile details or click "Pull from cloud" to restore.',
    );
  }

  const profileContent = JSON.stringify(profile, null, 2);

  // Bundle resumes and their PDF blobs
  const resumes = await listResumes();
  const resumePackages: GistResumePackage[] = await Promise.all(
    resumes.map(async (r) => {
      let base64Pdf: string | null = null;
      try {
        const blob = await getResumePdfBlob(r);
        if (blob) {
          base64Pdf = await blobToBase64(blob);
        }
      } catch (err) {
        console.warn(`Failed to read PDF blob for resume ${r.id}:`, err);
      }
      return {
        ...r,
        base64Pdf,
      };
    }),
  );

  const resumesContent = JSON.stringify(resumePackages, null, 2);

  const body = JSON.stringify({
    description: 'ApplyKit profile & resume backup',
    public: false,
    files: {
      [GIST_PROFILE_FILE]: { content: profileContent },
      [GIST_RESUMES_FILE]: { content: resumesContent },
    },
  });

  const url = targetGistId ? `${GIST_API}/${targetGistId}` : GIST_API;
  const method = targetGistId ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('GitHub token invalid or expired. Check your token in Cloud Sync settings.');
    }
    if (response.status === 404) {
      throw new Error('Gist not found. The ID may be wrong — try clearing it and pushing again.');
    }
    throw new Error(`GitHub API error ${response.status}: ${detail.slice(0, 120)}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

/**
 * Pull profile JSON and restore Resume PDFs from a GitHub Gist by ID.
 * Auto-recovery: If the latest revision was accidentally wiped with empty data,
 * automatically scans Gist commit history to recover the most recent populated revision!
 */
export async function pullProfileFromGist(
  token: string,
  gistId?: string,
): Promise<{ profile: Profile; gistId: string }> {
  let targetGistId = gistId?.trim();

  if (!targetGistId) {
    const existing = await findExistingApplyKitGist(token);
    if (existing) {
      targetGistId = existing;
    } else {
      throw new Error('No existing ApplyKit Gist found on your GitHub account. Push your profile first.');
    }
  }

  const response = await fetch(`${GIST_API}/${targetGistId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('GitHub token invalid or expired.');
    }
    if (response.status === 404) {
      throw new Error('Gist not found. Check the Gist ID in settings.');
    }
    throw new Error(`GitHub API error ${response.status}.`);
  }

  const data = (await response.json()) as {
    files?: Record<string, { content?: string }>;
    history?: Array<{ version: string; committed_at?: string }>;
  };

  let profileContent = data.files?.[GIST_PROFILE_FILE]?.content;
  let resumesContent = data.files?.[GIST_RESUMES_FILE]?.content;

  // Check if current revision profile is empty (e.g. wiped by an empty push)
  let isCurrentEmpty = false;
  if (profileContent) {
    try {
      const p = JSON.parse(profileContent) as Profile;
      if (!p.personal?.fullName?.trim() && !p.personal?.email?.trim()) {
        isCurrentEmpty = true;
      }
    } catch {
      isCurrentEmpty = true;
    }
  } else {
    isCurrentEmpty = true;
  }

  // AUTO-RECOVERY: If the current revision has empty data, search earlier Gist revisions!
  if (isCurrentEmpty && data.history && data.history.length > 1) {
    console.info('[ApplyKit] Latest Gist revision is empty. Scanning revision history for populated backup...');
    for (const entry of data.history.slice(1)) {
      try {
        const revResponse = await fetch(`${GIST_API}/${targetGistId}/${entry.version}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if (!revResponse.ok) continue;

        const revData = (await revResponse.json()) as {
          files?: Record<string, { content?: string }>;
        };
        const revProfileStr = revData.files?.[GIST_PROFILE_FILE]?.content;
        if (revProfileStr) {
          const p = JSON.parse(revProfileStr) as Profile;
          if (p.personal?.fullName?.trim() || p.personal?.email?.trim()) {
            profileContent = revProfileStr;
            if (revData.files?.[GIST_RESUMES_FILE]?.content) {
              resumesContent = revData.files[GIST_RESUMES_FILE].content;
            }
            console.info(
              `[ApplyKit] Successfully recovered populated profile from Gist revision ${entry.version.slice(0, 7)}`,
            );
            break;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch historical Gist revision:', err);
      }
    }
  }

  if (!profileContent) {
    throw new Error(`Gist does not contain "${GIST_PROFILE_FILE}". Push your profile first.`);
  }

  let parsedProfile: unknown;
  try {
    parsedProfile = JSON.parse(profileContent);
  } catch {
    throw new Error('Gist profile content is not valid JSON.');
  }

  // Restore Resumes if present
  if (resumesContent) {
    try {
      const parsedResumes = JSON.parse(resumesContent) as GistResumePackage[];
      if (Array.isArray(parsedResumes)) {
        const cleanResumes: ResumeVariant[] = [];
        for (const pkg of parsedResumes) {
          const { base64Pdf, ...resumeMeta } = pkg;
          cleanResumes.push(resumeMeta as ResumeVariant);

          if (base64Pdf && resumeMeta.blobKey) {
            try {
              const blob = base64ToBlob(base64Pdf, 'application/pdf');
              await putBlob(resumeMeta.blobKey, blob);
            } catch (err) {
              console.warn(`Failed to restore PDF blob for resume ${resumeMeta.id}:`, err);
            }
          }
        }
        await chrome.storage.local.set({ [RESUMES_STORAGE_KEY]: cleanResumes });
      }
    } catch (err) {
      console.warn('Failed to parse or restore resumes from Gist:', err);
    }
  }

  return {
    profile: normalizeProfile(parsedProfile as Partial<Profile>),
    gistId: targetGistId,
  };
}

// ─── Read-only URL ────────────────────────────────────────────────────────────

/**
 * Pull profile JSON from any public URL (read-only import, no auth).
 */
export async function pullProfileFromUrl(url: string): Promise<Profile> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Network error fetching profile URL. Check your connection.');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching profile URL.`);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error('Profile URL did not return valid JSON.');
  }

  return normalizeProfile(parsed as Partial<Profile>);
}
