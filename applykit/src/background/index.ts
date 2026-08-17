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
import { saveProfile } from '@/lib/profile';
import type { Profile } from '@/types/profile';

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

async function handleCloudPush(
  profile: Profile,
): Promise<{ ok: boolean; gistId?: string; error?: string }> {
  const settings = await loadCloudSettings();
  const token = await loadGithubToken();

  if (!settings.enabled) return { ok: false, error: 'Cloud sync is not enabled.' };

  if (settings.provider === 'github_gist') {
    if (!token) return { ok: false, error: 'GitHub token not configured.' };
    try {
      const gistId = await pushProfileToGist(profile, token, settings.gistId);
      const updated: CloudSyncSettings = {
        ...settings,
        gistId,
        lastSyncedAt: new Date().toISOString(),
      };
      await chrome.storage.local.set({ [CLOUD_SYNC_STORAGE_KEY]: updated });
      return { ok: true, gistId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Push failed.' };
    }
  }

  return { ok: false, error: `Provider "${settings.provider}" does not support push.` };
}

async function handleCloudPull(): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  const settings = await loadCloudSettings();
  const token = await loadGithubToken();

  if (!settings.enabled) return { ok: false, error: 'Cloud sync is not enabled.' };

  try {
    let pulled: Profile | null = null;

    if (settings.provider === 'github_gist') {
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

    // Always save pulled profile to local storage so all UI fields populate
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
    const msg = message as { type?: string; request?: AiGenerateRequest; profile?: Profile };

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
