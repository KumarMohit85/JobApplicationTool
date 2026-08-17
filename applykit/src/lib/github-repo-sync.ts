import { normalizeProfile } from '@/lib/profile';
import type { Profile } from '@/types/profile';
import type { QueueItem } from '@/types/queue';
import type { ResumeVariant } from '@/types/resume';
import { RESUMES_STORAGE_KEY } from '@/types/resume';
import { listResumes, getResumePdfBlob } from '@/lib/resumes';
import { putBlob } from '@/lib/db';

const GITHUB_API_BASE = 'https://api.github.com';

// ─── UTF-8 & Base64 Helpers ──────────────────────────────────────────────────

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(base64: string): string {
  const clean = base64.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to convert blob to Base64.'));
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
  const clean = base64.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// ─── GitHub API Helpers ──────────────────────────────────────────────────────

async function githubFetch(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers ?? {}),
    },
  });
  return response;
}

/** Get authenticated user's GitHub username. */
export async function getGitHubUsername(token: string): Promise<string> {
  const res = await githubFetch(token, '/user');
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid or expired GitHub Personal Access Token.');
    }
    throw new Error(`GitHub API error ${res.status}: Failed to get user profile.`);
  }
  const data = (await res.json()) as { login: string };
  return data.login;
}

/**
 * Ensure the target private repository exists.
 * If not present, automatically creates a private repository `owner/repoName`.
 */
export async function ensureGitHubRepo(
  token: string,
  owner: string,
  repoName: string,
): Promise<void> {
  const checkRes = await githubFetch(token, `/repos/${owner}/${repoName}`);
  if (checkRes.ok) return;

  if (checkRes.status === 404) {
    const createRes = await githubFetch(token, '/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: repoName,
        private: true,
        auto_init: true,
        description: 'ApplyKit Profile & Resume Backup (Private)',
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create private GitHub repository "${repoName}": ${errText.slice(0, 100)}`);
    }
  } else {
    throw new Error(`GitHub API error ${checkRes.status} checking repository "${owner}/${repoName}".`);
  }
}

/**
 * Fetch a single file from the repository contents.
 * Returns { content: string, sha: string } or null if file does not exist.
 */
async function getRepoFile(
  token: string,
  owner: string,
  repoName: string,
  filePath: string,
): Promise<{ content: string; sha: string } | null> {
  const res = await githubFetch(token, `/repos/${owner}/${repoName}/contents/${filePath}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to read "${filePath}" from GitHub repo: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { content?: string; sha: string };
  if (!data.content) return null;
  return { content: data.content, sha: data.sha };
}

/**
 * Create or update a file in the GitHub repository.
 */
async function putRepoFile(
  token: string,
  owner: string,
  repoName: string,
  filePath: string,
  contentBase64: string,
  commitMessage: string,
): Promise<void> {
  const existing = await getRepoFile(token, owner, repoName, filePath);
  const sha = existing?.sha;

  const res = await githubFetch(token, `/repos/${owner}/${repoName}/contents/${filePath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to save "${filePath}" to GitHub repo: ${errText.slice(0, 100)}`);
  }
}

// ─── Main Repo Sync Operations ──────────────────────────────────────────────

export type ConnectResult = {
  owner: string;
  repo: string;
  hasRemoteProfile: boolean;
  pulledProfile: Profile | null;
  message: string;
};

/**
 * SMART CONNECT: Called on first setup when user inputs GitHub Token.
 * 1. Checks/creates private repo `applykit-backup`.
 * 2. Checks if `profile.json` already exists in remote repo.
 * 3. If remote profile has data, automatically pulls & restores it!
 */
export async function connectGitHubRepo(
  token: string,
  repoName = 'applykit-backup',
): Promise<ConnectResult> {
  const owner = await getGitHubUsername(token);
  await ensureGitHubRepo(token, owner, repoName);

  const file = await getRepoFile(token, owner, repoName, 'profile.json');

  if (file?.content) {
    try {
      const utf8 = base64ToUtf8(file.content);
      const parsed = JSON.parse(utf8) as Partial<Profile>;
      const normalized = normalizeProfile(parsed);

      const hasData = Boolean(
        normalized.personal.fullName.trim() || normalized.personal.email.trim(),
      );

      if (hasData) {
        await pullResumesFromRepo(token, owner, repoName);

        return {
          owner,
          repo: repoName,
          hasRemoteProfile: true,
          pulledProfile: normalized,
          message: `Connected! Found existing profile for "${normalized.personal.fullName || normalized.personal.email}" in repository. Automatically restored!`,
        };
      }
    } catch (err) {
      console.warn('Failed to parse remote profile on connect:', err);
    }
  }

  return {
    owner,
    repo: repoName,
    hasRemoteProfile: false,
    pulledProfile: null,
    message: `Connected to repository "${owner}/${repoName}". Cloud sync is ready.`,
  };
}

/**
 * Push profile JSON + Resume PDFs to private GitHub repository.
 */
export async function pushProfileToRepo(
  token: string,
  owner: string,
  repoName: string,
  profile: Profile,
): Promise<void> {
  const isEmpty = !profile.personal.fullName.trim() && !profile.personal.email.trim();
  if (isEmpty) {
    const existingFile = await getRepoFile(token, owner, repoName, 'profile.json');
    if (existingFile?.content) {
      try {
        const existingUtf8 = base64ToUtf8(existingFile.content);
        const parsed = JSON.parse(existingUtf8) as Profile;
        if (parsed.personal?.fullName?.trim() || parsed.personal?.email?.trim()) {
          throw new Error(
            'Cannot push an empty local profile over an existing populated GitHub backup. Fill your profile or click Pull first.',
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Cannot push')) throw err;
      }
    }
  }

  const profileJson = JSON.stringify(profile, null, 2);
  const profileBase64 = utf8ToBase64(profileJson);
  await putRepoFile(
    token,
    owner,
    repoName,
    'profile.json',
    profileBase64,
    `Update profile (${new Date().toISOString().slice(0, 10)})`,
  );

  await pushResumesToRepo(token, owner, repoName);
}

/**
 * Pull profile JSON + Resume PDFs from private GitHub repository.
 */
export async function pullProfileFromRepo(
  token: string,
  owner: string,
  repoName: string,
): Promise<Profile> {
  const file = await getRepoFile(token, owner, repoName, 'profile.json');
  if (!file?.content) {
    throw new Error(`No "profile.json" found in repository "${owner}/${repoName}". Push your profile first.`);
  }

  const utf8 = base64ToUtf8(file.content);
  const parsed = JSON.parse(utf8) as Partial<Profile>;
  const profile = normalizeProfile(parsed);

  await pullResumesFromRepo(token, owner, repoName);

  return profile;
}

/** Push queue items array to queue.json in GitHub repo. */
export async function pushQueueToRepo(
  token: string,
  owner: string,
  repoName: string,
  queueItems: QueueItem[],
): Promise<void> {
  const json = JSON.stringify(queueItems, null, 2);
  const b64 = utf8ToBase64(json);
  await putRepoFile(
    token,
    owner,
    repoName,
    'queue.json',
    b64,
    `Update mail queue (${queueItems.length} items)`,
  );
}

/** Pull queue items array from queue.json in GitHub repo. */
export async function pullQueueFromRepo(
  token: string,
  owner: string,
  repoName: string,
): Promise<QueueItem[]> {
  const file = await getRepoFile(token, owner, repoName, 'queue.json');
  if (!file?.content) return [];

  try {
    const utf8 = base64ToUtf8(file.content);
    const items = JSON.parse(utf8) as QueueItem[];
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.warn('Failed to parse queue.json from repo:', err);
    return [];
  }
}

/** Push all local resume variants & PDF blobs to repo. */
async function pushResumesToRepo(
  token: string,
  owner: string,
  repoName: string,
): Promise<void> {
  const resumes = await listResumes();
  if (resumes.length === 0) return;

  const metadataJson = JSON.stringify(resumes, null, 2);
  await putRepoFile(
    token,
    owner,
    repoName,
    'resumes/resumes.json',
    utf8ToBase64(metadataJson),
    'Update resume list metadata',
  );

  for (const r of resumes) {
    try {
      const blob = await getResumePdfBlob(r);
      if (blob) {
        const b64 = await blobToBase64(blob);
        const pdfPath = `resumes/pdf/${r.id}.pdf`;
        await putRepoFile(
          token,
          owner,
          repoName,
          pdfPath,
          b64,
          `Update resume PDF: ${r.name}`,
        );
      }
    } catch (err) {
      console.warn(`Failed to push resume PDF ${r.id}:`, err);
    }
  }
}

/** Pull resumes metadata & PDF blobs from repo into local IndexedDB. */
async function pullResumesFromRepo(
  token: string,
  owner: string,
  repoName: string,
): Promise<void> {
  const file = await getRepoFile(token, owner, repoName, 'resumes/resumes.json');
  if (!file?.content) return;

  try {
    const utf8 = base64ToUtf8(file.content);
    const resumes = JSON.parse(utf8) as ResumeVariant[];
    if (!Array.isArray(resumes)) return;

    for (const r of resumes) {
      if (r.blobKey && r.id) {
        try {
          const pdfFile = await getRepoFile(token, owner, repoName, `resumes/pdf/${r.id}.pdf`);
          if (pdfFile?.content) {
            const blob = base64ToBlob(pdfFile.content, 'application/pdf');
            await putBlob(r.blobKey, blob);
          }
        } catch (err) {
          console.warn(`Failed to pull PDF for resume ${r.id}:`, err);
        }
      }
    }

    await chrome.storage.local.set({ [RESUMES_STORAGE_KEY]: resumes });
  } catch (err) {
    console.warn('Failed to pull resumes from repo:', err);
  }
}
