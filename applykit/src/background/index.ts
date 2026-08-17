import type { AiGenerateRequest, AiGenerateResponse } from '@/types/ai';
import type { AiSettings } from '@/types/ai-settings';
import { AI_SETTINGS_STORAGE_KEY, createDefaultAiSettings } from '@/types/ai-settings';
import {
  CLOUD_SYNC_STORAGE_KEY,
  GITHUB_TOKEN_STORAGE_KEY,
  createDefaultCloudSyncSettings,
} from '@/types/cloud-sync';
import type { CloudSyncSettings } from '@/types/cloud-sync';
import { callGemini, testGeminiConnection } from '@/lib/ai/gemini';
import {
  pushProfileToGist,
  pullProfileFromGist,
  pullProfileFromUrl,
} from '@/lib/cloud-sync';
import {
  connectGitHubRepo,
  pushProfileToRepo,
  pullProfileFromRepo,
  pushQueueToRepo,
  pullQueueFromRepo,
  getGitHubUsername,
} from '@/lib/github-repo-sync';
import { parseHiringPost, type ParsedJobEntry } from '@/lib/post-parser';
import { saveProfile } from '@/lib/profile';
import type { Profile } from '@/types/profile';
import type { QueueItem } from '@/types/queue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadAiSettings(): Promise<AiSettings> {
  const result = await chrome.storage.local.get(AI_SETTINGS_STORAGE_KEY);
  const stored = result[AI_SETTINGS_STORAGE_KEY] as Partial<AiSettings> | undefined;
  return { ...createDefaultAiSettings(), ...(stored ?? {}) };
}

async function loadCloudSettings(): Promise<CloudSyncSettings> {
  const result = await chrome.storage.local.get(CLOUD_SYNC_STORAGE_KEY);
  const stored = result[CLOUD_SYNC_STORAGE_KEY] as Partial<CloudSyncSettings> | undefined;
  return { ...createDefaultCloudSyncSettings(), ...(stored ?? {}) };
}

async function loadGithubToken(): Promise<string> {
  const result = await chrome.storage.local.get(GITHUB_TOKEN_STORAGE_KEY);
  return (result[GITHUB_TOKEN_STORAGE_KEY] as string | undefined) ?? '';
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleAiGenerate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
  const settings = await loadAiSettings();
  return callGemini(settings, request);
}

async function handleAiTest(): Promise<AiGenerateResponse> {
  const settings = await loadAiSettings();
  const result = await testGeminiConnection(settings);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * AI-powered hiring post parser. Uses Gemini LLM to extract company, role, emails, apply URLs,
 * and job descriptions from complex posts. Falls back to smart local parser if AI is offline.
 */
async function handleAiParsePost(
  rawText: string,
  sourceUrl: string,
): Promise<{ ok: boolean; jobs: ParsedJobEntry[]; source: 'ai' | 'local' }> {
  const settings = await loadAiSettings();

  if (!settings.enabled || !settings.apiKey.trim()) {
    const jobs = parseHiringPost(rawText, sourceUrl);
    return { ok: true, jobs, source: 'local' };
  }

  const prompt = `You are an expert AI recruitment text parser. Analyze the hiring post text below and extract ALL job openings into a JSON array.

Strict Requirements:
1. Extract exact "company" name for each job.
2. Extract exact "role" or job title.
3. Extract recruiter/contact "email" if present (otherwise empty "").
4. Extract direct apply links into "applyUrls" array (ignore WhatsApp group links, Telegram, YouTube, and interview prep kit links).
5. Extract a concise "description" summarizing job requirements, location, experience, and salary/CTC.
6. Output ONLY a valid JSON array matching this structure:
[
  {
    "company": "Company Name",
    "role": "Role Title",
    "email": "email@example.com",
    "applyUrls": ["https://..."],
    "description": "Job details summary"
  }
]

Post Content:
"""
${rawText}
"""`;

  const model = settings.model?.trim() ? settings.model.trim() : 'gemini-3.7-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey.trim())}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      let parsedArray: unknown;
      try {
        parsedArray = JSON.parse(text);
      } catch {
        const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          parsedArray = JSON.parse(match[0]);
        }
      }

      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        const jobs: ParsedJobEntry[] = parsedArray.map((item) => {
          const obj = item as Partial<ParsedJobEntry>;
          const urls: string[] = Array.isArray(obj.applyUrls)
            ? obj.applyUrls.map((u) => String(u).trim()).filter((u) => u.startsWith('http'))
            : typeof obj.applyUrl === 'string' && obj.applyUrl.trim()
              ? [obj.applyUrl.trim()]
              : [];

          return {
            company: String(obj.company || 'Hiring Company').trim(),
            role: String(obj.role || 'Open Position').trim(),
            email: String(obj.email || '').trim().toLowerCase(),
            applyUrl: urls[0] || '',
            applyUrls: urls,
            description: String(obj.description || rawText.slice(0, 1000)).trim(),
            sourceUrl,
          };
        });

        return { ok: true, jobs, source: 'ai' };
      }
    }
  } catch (err) {
    console.warn('[ApplyKit] AI post parsing error, using local parser:', err);
  }

  const jobs = parseHiringPost(rawText, sourceUrl);
  return { ok: true, jobs, source: 'local' };
}

async function handleCloudConnect(
  token?: string,
  repoName?: string,
): Promise<{
  ok: boolean;
  owner?: string;
  repo?: string;
  pulledProfile?: Profile;
  message?: string;
  error?: string;
}> {
  const settings = await loadCloudSettings();
  const githubToken = token || (await loadGithubToken());
  const targetRepo = repoName || settings.repo || 'applykit-backup';

  if (!githubToken) return { ok: false, error: 'GitHub Personal Access Token is required.' };

  try {
    const result = await connectGitHubRepo(githubToken, targetRepo);

    const updated: CloudSyncSettings = {
      ...settings,
      enabled: true,
      provider: 'github_repo',
      owner: result.owner,
      repo: result.repo,
      lastSyncedAt: new Date().toISOString(),
    };

    await chrome.storage.local.set({
      [CLOUD_SYNC_STORAGE_KEY]: updated,
      [GITHUB_TOKEN_STORAGE_KEY]: githubToken,
    });

    if (result.hasRemoteProfile && result.pulledProfile) {
      await saveProfile(result.pulledProfile);
    }

    // Also pull queue from repo if present
    const remoteQueue = await pullQueueFromRepo(githubToken, result.owner, result.repo);
    if (remoteQueue.length > 0) {
      const { importQueueItems } = await import('@/lib/queue');
      await importQueueItems(remoteQueue);
    }

    return {
      ok: true,
      owner: result.owner,
      repo: result.repo,
      pulledProfile: result.pulledProfile ?? undefined,
      message: result.message,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connect failed.' };
  }
}

async function handleCloudPushQueue(
  queueItems: QueueItem[],
): Promise<{ ok: boolean; error?: string }> {
  const settings = await loadCloudSettings();
  const token = await loadGithubToken();

  if (!settings.enabled || !token) return { ok: false };

  try {
    if (settings.provider === 'github_repo') {
      const owner = settings.owner || (await getGitHubUsername(token));
      const repo = settings.repo || 'applykit-backup';
      await pushQueueToRepo(token, owner, repo, queueItems);
      return { ok: true };
    }
  } catch (err) {
    console.warn('[ApplyKit] Failed to push queue to GitHub repo:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Push failed' };
  }
  return { ok: false };
}

async function handleCloudPush(
  profile: Profile,
): Promise<{ ok: boolean; gistId?: string; error?: string }> {
  const settings = await loadCloudSettings();
  const token = await loadGithubToken();

  if (!settings.enabled) return { ok: false, error: 'Cloud sync is not enabled.' };
  if (!token && settings.provider !== 'url') return { ok: false, error: 'GitHub token not configured.' };

  try {
    if (settings.provider === 'github_repo') {
      const owner = settings.owner || (await getGitHubUsername(token));
      const repo = settings.repo || 'applykit-backup';
      await pushProfileToRepo(token, owner, repo, profile);

      // Also push queue
      const { listQueue } = await import('@/lib/queue');
      const queueItems = await listQueue();
      await pushQueueToRepo(token, owner, repo, queueItems);

      const updated: CloudSyncSettings = {
        ...settings,
        owner,
        repo,
        lastSyncedAt: new Date().toISOString(),
      };
      await chrome.storage.local.set({ [CLOUD_SYNC_STORAGE_KEY]: updated });
      return { ok: true };
    }

    if (settings.provider === 'github_gist') {
      const gistId = await pushProfileToGist(profile, token, settings.gistId);
      const updated: CloudSyncSettings = {
        ...settings,
        gistId,
        lastSyncedAt: new Date().toISOString(),
      };
      await chrome.storage.local.set({ [CLOUD_SYNC_STORAGE_KEY]: updated });
      return { ok: true, gistId };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Push failed.' };
  }

  return { ok: false, error: `Provider "${settings.provider}" does not support push.` };
}

async function handleCloudPull(): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  const settings = await loadCloudSettings();
  const token = await loadGithubToken();

  if (!settings.enabled) return { ok: false, error: 'Cloud sync is not enabled.' };

  try {
    let pulled: Profile | null = null;

    if (settings.provider === 'github_repo') {
      if (!token) return { ok: false, error: 'GitHub token not configured.' };
      const owner = settings.owner || (await getGitHubUsername(token));
      const repo = settings.repo || 'applykit-backup';
      pulled = await pullProfileFromRepo(token, owner, repo);

      // Also pull queue
      const remoteQueue = await pullQueueFromRepo(token, owner, repo);
      if (remoteQueue.length > 0) {
        const { importQueueItems } = await import('@/lib/queue');
        await importQueueItems(remoteQueue);
      }
    } else if (settings.provider === 'github_gist') {
      if (!token) return { ok: false, error: 'GitHub token not configured.' };
      const res = await pullProfileFromGist(token, settings.gistId);
      pulled = res.profile;
      if (res.gistId && res.gistId !== settings.gistId) {
        settings.gistId = res.gistId;
      }
    } else if (settings.provider === 'url') {
      if (!settings.profileUrl) return { ok: false, error: 'Profile URL not configured.' };
      pulled = await pullProfileFromUrl(settings.profileUrl);
    }

    if (!pulled) return { ok: false, error: 'No profile data returned from cloud.' };

    await saveProfile(pulled);

    const updated: CloudSyncSettings = { ...settings, lastSyncedAt: new Date().toISOString() };
    await chrome.storage.local.set({ [CLOUD_SYNC_STORAGE_KEY]: updated });

    return { ok: true, profile: pulled };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Pull failed.' };
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.info('[ApplyKit] Extension installed / updated.');
});

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (r: unknown) => void): true | undefined => {
    const msg = message as {
      type?: string;
      request?: AiGenerateRequest;
      profile?: Profile;
      token?: string;
      repoName?: string;
      rawText?: string;
      sourceUrl?: string;
      queueItems?: QueueItem[];
    };

    if (msg.type === 'PING') {
      sendResponse({ ok: true, version: '0.2.0' });
      return undefined;
    }

    if (msg.type === 'AI_GENERATE' && msg.request) {
      void handleAiGenerate(msg.request).then(sendResponse);
      return true;
    }

    if (msg.type === 'AI_TEST') {
      void handleAiTest().then(sendResponse);
      return true;
    }

    if (msg.type === 'AI_PARSE_POST' && msg.rawText) {
      void handleAiParsePost(msg.rawText, msg.sourceUrl || '').then(sendResponse);
      return true;
    }

    if (msg.type === 'CLOUD_CONNECT') {
      void handleCloudConnect(msg.token, msg.repoName).then(sendResponse);
      return true;
    }

    if (msg.type === 'CLOUD_PUSH_QUEUE' && msg.queueItems) {
      void handleCloudPushQueue(msg.queueItems).then(sendResponse);
      return true;
    }

    if (msg.type === 'CLOUD_PUSH' && msg.profile) {
      void handleCloudPush(msg.profile).then(sendResponse);
      return true;
    }

    if (msg.type === 'CLOUD_PULL') {
      void handleCloudPull().then(sendResponse);
      return true;
    }

    return undefined;
  },
);

// Startup cloud pull if cloud-primary is enabled
chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const settings = await loadCloudSettings();
    if (settings.enabled && settings.cloudPrimary) {
      const result = await handleCloudPull();
      if (!result.ok) {
        console.warn('[ApplyKit] Cloud pull on startup failed:', result.error);
      }
    }
  })();
});

export {};
