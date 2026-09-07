# Architecture

How ApplyKit is built, how pieces talk to each other, and where data lives.

---

## Product shape

ApplyKit is a **Chrome extension** (Manifest V3), not a web app with a backend. All user data stays in the browser unless the user opts into:

- **Gemini API** (cover letters, job review, hiring-post parsing)
- **GitHub** (private repo or gist backup)

There is no ApplyKit server.

---

## Tech stack (actual)

| Layer | Choice | File / config |
|-------|--------|----------------|
| Extension format | Manifest V3 | `applykit/manifest.config.ts` |
| Language | TypeScript 5.7 | `applykit/tsconfig.json` |
| UI | React 18 | Popup, options, side panel |
| Build | Vite 5 + `@crxjs/vite-plugin` | `applykit/vite.config.ts` |
| Styling | Tailwind CSS 3 | `applykit/src/assets/tailwind.css` |
| Path alias | `@/` → `src/` | Vite + tsconfig |

The product plan mentions WXT; the repo uses **CRXJS**, not WXT. CSV is a **custom parser** in `lib/csv.ts` (no Papa Parse). IndexedDB is a small custom wrapper in `lib/db.ts` (no `idb` package).

Scripts:

```bash
cd applykit
npm run dev       # Vite watch; load applykit/dist in chrome://extensions
npm run build     # tsc --noEmit && vite build
npm run compile   # typecheck only
```

---

## Project layout

```
JobApplicationTool/
├── README.md                 # repo entry
├── SETUP.md                  # clone → build → load
├── docs/                     # this documentation
└── applykit/                 # extension source
    ├── manifest.config.ts
    ├── vite.config.ts
    └── src/
        ├── background/index.ts          # service worker (AI + cloud + parse + custom answers)
        ├── content/
        │   ├── index.ts                 # all-pages content script
        │   ├── extract.ts               # job context router
        │   ├── insert.ts                # paste into focused field
        │   ├── post-capture.ts          # read a LinkedIn post DOM
        │   ├── post-overlay.ts          # Save buttons on feed posts
        │   ├── gmail-index.ts           # Gmail-only content script
        │   ├── gmail-fill.ts            # To / subject / body inject
        │   ├── adapters/                # JD extractors (LinkedIn, GH, Lever, generic)
        │   └── autofill/                # fill engine + ATS adapters + form learner
        ├── popup/                       # toolbar popup
        ├── options/                     # full settings page (open_in_tab)
        ├── sidepanel/                   # Chrome Side Panel
        ├── components/                  # shared React UI
        ├── hooks/                       # useProfile, useJobContext, useAi*, useCloudSync
        ├── lib/                         # domain logic (no DOM except downloads)
        └── types/                       # TypeScript models + storage keys
```

Three HTML entry points (Vite `rollupOptions.input`):

- `src/popup/index.html`
- `src/options/index.html`
- `src/sidepanel/index.html`

---

## Manifest (permissions and injection)

From `manifest.config.ts`:

**Permissions:** `storage`, `activeTab`, `sidePanel`, `scripting`, `downloads`, `tabs`

**Host permissions:**

- `https://www.linkedin.com/*`
- `https://boards.greenhouse.io/*`
- `https://job-boards.greenhouse.io/*`
- `https://jobs.lever.co/*`
- `https://mail.google.com/*`
- `https://generativelanguage.googleapis.com/*` (Gemini)
- `https://api.github.com/*` (cloud sync)

**Content scripts:**

| Matches | Script | Role |
|---------|--------|------|
| `<all_urls>` | `src/content/index.ts` | Extract, insert, autofill, LinkedIn overlay, form learner |
| `https://mail.google.com/*` | `src/content/gmail-index.ts` | Apply pending compose + `FILL_GMAIL_COMPOSE` |

The all-URLs script still **refuses** `chrome://`, `chrome-extension://`, `edge://`, and `about:` via `isRestrictedUrl()`.

**UI surfaces:**

- Toolbar **popup** (`action.default_popup`)
- **Options** page opened in a tab (`options_ui.open_in_tab: true`)
- Chrome **Side Panel** (`side_panel.default_path`)
- **Background** service worker (`type: module`)

---

## Storage model

Three storage layers:

### 1. `chrome.storage.local` — durable app data

| Key | Type | Module |
|-----|------|--------|
| `applykit_profile` | `Profile` | `lib/profile.ts` |
| `applykit_resumes` | `ResumeVariant[]` | `lib/resumes.ts` |
| `applykit_queue` | `QueueItem[]` | `lib/queue.ts` |
| `applykit_activity_log` | `ActivityEntry[]` | `lib/activity-log.ts` |
| `applykit_ai_settings` | `AiSettings` | `hooks/useAiSettings.ts` |
| `applykit_cloud_sync` | `CloudSyncSettings` | `hooks/useCloudSync.ts` |
| `applykit_github_token` | `string` | same (kept separate from settings JSON) |

All list stores **normalize** on read (drop invalid rows, fill defaults). Profile always comes back as a complete `Profile` via `normalizeProfile()`.

### 2. IndexedDB `applykit` — resume PDF bytes

Database name `applykit`, version `1`, object store `blobs` (key/value).

- `putBlob(blobKey, File)` on resume save
- `getBlob` for download / Gmail attach / cloud backup
- `deleteBlob` on resume delete

Metadata (name, description, skills) is **not** in IndexedDB; only the PDF.

### 3. `chrome.storage.session` — ephemeral

| Key | Type | Lifetime |
|-----|------|----------|
| `applykit_last_job_context` | `JobContext` | Until browser session ends |
| `applykit_pending_compose` | `PendingCompose` | Until Gmail fill succeeds |
| `applykit_page_selection` | Last highlighted page text | Add selection after side panel steals focus |
| `applykit_last_autofill` | Last fill result + URL | Side panel Needs you after any fill |
| `applykit_active_apply` | `{ queueItemId, tabId }` | Queue Fill & apply session |

Session storage is used so a job scan survives closing the side panel, and so Gmail can pick up To/subject/body after a new tab is opened.

---

## Message passing

Chrome extensions cannot share JS memory across popup, side panel, options, background, and page. Features hop over `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`.

### UI / options / side panel → background

Handled in `src/background/index.ts`:

| `type` | Payload | Handler |
|--------|---------|---------|
| `PING` | — | `{ ok, version: '0.2.0' }` |
| `AI_GENERATE` | `AiGenerateRequest` | Gemini generateContent |
| `AI_TEST` | — | Tiny review call to verify the key |
| `AI_PARSE_POST` | `rawText`, `sourceUrl` | Gemini JSON job extract, else local parser |
| `SAVE_CUSTOM_ANSWER` | `question`, `answer`, optional `siteHint`, `source` | Upsert Answer Bank, optional cloud push |
| `AI_ANSWER_FIELDS` | `fields: ScannedField[]` | Gemini fill/ask/skip for leftover controls |
| `FILL_TAB_WHEN_READY` | `tabId` | Wait for load, inject content script, `AUTOFILL` form+AI |
| `CLOUD_CONNECT` | `token`, `repoName` | Create/find repo, pull profile+queue |
| `CLOUD_PUSH` | `profile` | Push profile (+ resumes + queue for repo) |
| `CLOUD_PULL` | — | Pull and `saveProfile` |
| `CLOUD_PUSH_QUEUE` | `queueItems` | Repo `queue.json` only |

Gemini and GitHub tokens are read **only in the service worker**, so page scripts never see them.

### UI → content script (active tab)

Sent via `lib/tab-messages.ts` / `lib/autofill-client.ts`:

| `type` | Result |
|--------|--------|
| `PING` | Confirm script is alive |
| `GET_JOB_CONTEXT` | `JobContext \| null` |
| `GET_SELECTED_TEXT` | Highlighted text (or last remembered selection) |
| `INSERT_TEXT` | Insert into focused control |
| `AUTOFILL` | Fill form / Easy Apply modal |
| `FILL_FIELD` | Fill one control by question label |
| `CAPTURE_LINKEDIN_POST` | Parsed post payload |
| `FILL_GMAIL_COMPOSE` | Gmail-only script |

If `tabs.sendMessage` fails (extension reloaded while the tab stayed open), `ensureContentScript()` uses `chrome.scripting.executeScript` to inject `src/content/index.ts` and retries.

### Background → content (Gmail)

`prepareMailSend()` writes `PendingCompose` to session storage and opens a Gmail compose URL. The Gmail content script reads it on load and retries fill at 0ms, 1.2s, and 2.5s (Gmail’s compose DOM is slow).

### Queue → background (cloud)

`saveQueueList()` in `lib/queue.ts` fires `CLOUD_PUSH_QUEUE` after every local write so the GitHub repo stays in sync without a dedicated “sync queue” button.

---

## Data flow (end to end)

```
chrome.storage.local          IndexedDB blobs
  Profile, skills,                Resume PDFs
  resumes metadata,
  queue, activity
        │
        ▼
 Side panel / popup / options
        │  tabs.sendMessage
        ▼
 Content script on job page
        │  extract / fill / insert / learn answers
        ▼
 DOM (LinkedIn, Greenhouse, Lever, generic, Gmail)

 Optional:
   Side panel ──AI_GENERATE──► background ──HTTPS──► Gemini
   Content    ──AI_ANSWER_FIELDS──► background ──HTTPS──► Gemini
   Options    ──CLOUD_PUSH──► background ──HTTPS──► GitHub
```

---

## React app boundaries

Each UI surface is a **separate React tree** (separate HTML page):

| Surface | Root | Loads profile via |
|---------|------|-------------------|
| Options | `options/App.tsx` | `useProfile` (cloud-primary pull) |
| Side panel | `sidepanel/App.tsx` | `useProfile` + `useJobContext(true)` |
| Popup | `popup/App.tsx` | No profile hook; talks to tab + queue directly |

Shared primitives live in `components/ui.tsx`: `Field`, `TextInput`, `TextArea`, `Select`, `Button`, `SectionCard`, `StatusBanner`.

---

## IDs and dates

- List item IDs (`Skill`, `Experience`, `Education`, `ResumeVariant`, `QueueItem`, `ActivityEntry`) use `crypto.randomUUID()` via `lib/id.ts`.
- Timestamps are ISO strings (`updatedAt`, `createdAt`, `extractedAt`, `timestamp`).
- Profile `version` is always `1` after normalize.

---

## Privacy implications of this architecture

- Autofill and matching run **offline** in the content script / UI.
- AI sends profile summary, skills, experience titles, resume **metadata** (not PDF bytes), and truncated JD to Google.
- Cloud sync sends profile JSON, resume PDFs (base64), and queue JSON to GitHub under the user’s token.
- Content script on `<all_urls>` can see page DOM; it does not phone home. Form learner only stores question/answer pairs the user typed.
