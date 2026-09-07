# Cloud profile sync

Optional backup of profile, resume PDFs, and (repo provider) the mail queue to GitHub or a public JSON URL.

Tokens live in `chrome.storage.local` under **`applykit_github_token`**, separate from settings JSON **`applykit_cloud_sync`**.

---

## Settings model (`src/types/cloud-sync.ts`)

```ts
{
  enabled: boolean;
  provider: 'github_repo' | 'github_gist' | 'url';
  cacheLocally: boolean;      // default true (local copy always kept today)
  cloudPrimary: boolean;      // auto-pull on extension startup and Options load
  gistId?: string;
  owner?: string;
  repo?: string;              // default 'applykit-backup'
  path?: string;              // default 'profile.json' (repo)
  branch?: string;            // default 'main'
  profileUrl?: string;        // read-only URL provider
  lastSyncedAt?: string;
}
```

Default provider in code is **`github_repo`**, not gist.

Options **Cloud sync** tab: enable, provider select, token Show/Hide, connect / push / pull, **Auto-pull cloud profile on extension startup** (`cloudPrimary`). Connected repos show a link to `github.com/{owner}/{repo}`.

---

## Message API (background)

| Type | Effect |
|------|--------|
| `CLOUD_CONNECT` | Token + repo name → create/find private repo, pull profile if populated, import remote queue, persist owner/repo, enable sync |
| `CLOUD_PUSH` | Push according to `settings.provider` |
| `CLOUD_PULL` | Pull, `saveProfile`, update `lastSyncedAt` |
| `CLOUD_PUSH_QUEUE` | Repo only: write `queue.json` |

`chrome.runtime.onStartup`: if `enabled && cloudPrimary`, pull. `useProfile.reload` does the same on Options/side panel load.

Saving the profile in Options always attempts `CLOUD_PUSH` (background no-ops if sync is disabled).

---

## Provider: private GitHub repository (recommended)

Files: `lib/github-repo-sync.ts`. Token needs **`repo`** scope. Host: `https://api.github.com/*`.

### Connect (`connectGitHubRepo`)

1. `GET /user` → username (`owner`)
2. `ensureGitHubRepo`: `GET /repos/{owner}/{repo}`; on 404, `POST /user/repos` with `private: true`, `auto_init: true`, description ApplyKit backup
3. Read `profile.json`. If it parses and has name or email, **pull resumes** and return `pulledProfile`
4. Background also `pullQueueFromRepo` → `importQueueItems`

UI button: **Connect & Auto-Sync Cloud**.

### Push (`pushProfileToRepo`)

**Empty-profile guard:** if local name and email are blank **and** remote `profile.json` has data, throw — do not wipe the backup.

Writes:

| Path | Content |
|------|---------|
| `profile.json` | UTF-8 JSON, GitHub contents API (base64), commit message `Update profile (YYYY-MM-DD)` |
| `resumes/resumes.json` | Resume metadata array |
| `resumes/pdf/{resume.id}.pdf` | PDF file bytes as base64 |
| `queue.json` | Full queue (from `CLOUD_PUSH` and from every local queue mutation) |

`putRepoFile` GETs existing SHA so updates are `PUT` with `sha` (required by GitHub Contents API).

### Pull (`pullProfileFromRepo`)

Read `profile.json` → `normalizeProfile` → `pullResumesFromRepo` (metadata + each PDF into IndexedDB `blobKey`). Queue pull is in the background handler.

UTF-8 is encoded with `TextEncoder` / `TextDecoder` (not naive `btoa` of JS strings) so names with non-ASCII survive.

---

## Provider: GitHub Gist

Files: `lib/cloud-sync.ts`. Token needs **`gist`** scope.

Gist files:

- `applykit-profile.json`
- `applykit-resumes.json` — array of resume metadata + optional `base64Pdf`

Gists are created **`public: false`**.

### Discover

`findExistingApplyKitGist` lists up to 100 gists, finds those containing `applykit-profile.json`, picks the most recently updated. Used when `gistId` is empty so reinstalls do not create duplicates.

### Push (`pushProfileToGist`)

Same empty-profile guard if a target gist exists. `POST /gists` or `PATCH /gists/{id}`. Returns gist id (saved to settings).

PDFs are inlined as base64 in JSON (gist file size limits apply for large libraries).

### Pull (`pullProfileFromGist`)

`GET /gists/{id}`. If the latest revision’s profile has empty name **and** email, **walk `history`** (skip first = current) and `GET /gists/{id}/{version}` until a populated profile is found. Restores resumes into IndexedDB.

If no gist id and none discovered: error “Push your profile first.”

Queue is **not** stored in gists.

---

## Provider: read-only URL

`pullProfileFromUrl(url)` — `fetch` with `Accept: application/json`, `normalizeProfile`. No push. Typical use: public gist raw URL or a hosted `applykit-profile.json`.

Does not restore PDFs (JSON profile only).

---

## Queue sync details

`lib/queue.ts` `saveQueueList` → `CLOUD_PUSH_QUEUE`. Background:

- Requires `enabled` and token
- Only `provider === 'github_repo'`
- `pushQueueToRepo` overwrites `queue.json`

Pull merges via `importQueueItems` (ids update, duplicates skip). It does not delete local-only rows.

---

## Profile save vs cloud-primary

| Flag | Behavior |
|------|----------|
| `enabled` false | Local only |
| `enabled`, `cloudPrimary` false | Local is source; push on Save / explicit Push |
| `enabled`, `cloudPrimary` true | Pull on browser start and when Options/side panel load profile; still caches locally (`saveProfile` after pull) |

`cacheLocally` exists on the type but the UI does not expose it; profile JSON is always written locally on save/pull.

---

## Failure modes (user-facing)

| Symptom | Likely cause |
|---------|----------------|
| 401 | Token expired or wrong scopes (`repo` vs `gist`) |
| 404 gist | Bad gist id — clear id and push |
| Cannot push empty profile | Guard fired; pull first or fill name/email |
| Connect fails | Network, token, or repo create permission |

Background catch blocks attach a short stack location to the error string for debugging.

---

## What is and is not synced

| Data | Repo | Gist | URL |
|------|------|------|-----|
| Profile JSON | yes | yes | pull only |
| Resume metadata | yes | yes | no |
| Resume PDFs | yes (files) | yes (base64 in JSON) | no |
| Mail queue | yes (`queue.json`) | no | no |
| Activity log | no | no | no |
| AI API key | no | no | no |
| GitHub token | no (stays in chrome.storage) | no | no |

Activity log and Gemini key remain device-local by design.
