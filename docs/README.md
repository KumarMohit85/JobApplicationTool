# ApplyKit — Feature documentation

This folder documents **what is actually implemented** in the ApplyKit Chrome extension, and **how each feature works in code**. It is derived from the source under `applykit/src/`, not only from the product plan in `applykit/README.md`.

ApplyKit is a Manifest V3 Chrome extension that stores a local professional profile, matches skills and resume variants to a job description, autofills application forms, captures LinkedIn hiring posts into a mail/apply queue, and optionally uses Gemini AI plus GitHub cloud backup.

**Safety rule:** the extension never auto-clicks LinkedIn Send or application Submit. The user always submits.

---

## How to use these docs

| Document | What it covers |
|----------|----------------|
| [architecture.md](./architecture.md) | Stack, project layout, permissions, message passing, storage |
| [profile-and-library.md](./profile-and-library.md) | Profile, skills, resumes, experience, education, Easy Apply defaults |
| [job-context-and-matching.md](./job-context-and-matching.md) | Page extraction, skill/resume matching, template generation, copy/insert |
| [ui-surfaces.md](./ui-surfaces.md) | Options page, side panel, popup |
| [autofill.md](./autofill.md) | Autofill engine, LinkedIn Easy Apply, Greenhouse, Lever, generic adapters |
| [form-fill.md](./form-fill.md) | Scan leftover fields, Answer Bank, AI fill, Needs you, queue apply session |
| [queue-and-mail.md](./queue-and-mail.md) | LinkedIn post capture, queue, CSV, Gmail send assist, activity log, backup |
| [ai.md](./ai.md) | Gemini cover/email generation, job review, hiring-post parsing, leftover form-field fill |
| [cloud-sync.md](./cloud-sync.md) | GitHub repo, Gist, read-only URL, resume PDF backup, queue sync |

---

## Feature catalog (implemented)

Status is **implemented** unless noted. IDs in parentheses map to `applykit/README.md` where they exist.

### Profile & data

| Feature | Where it lives | Notes |
|---------|----------------|-------|
| Profile storage (F1) | `lib/profile.ts`, Options Personal tab | `chrome.storage.local`, key `applykit_profile` |
| Skills library (F2) | `lib/skills.ts`, Options Skills tab | Level weights + keyword aliases |
| Resume library (F3) | `lib/resumes.ts`, `lib/db.ts` | Metadata in storage, PDF blobs in IndexedDB |
| Google Drive resume link | Resume type `driveUrl` | Optional public URL appended to cold emails |
| Experience CRUD | Options Experience tab | Company, title, dates, bullets, technologies |
| Education CRUD | Options Education tab | School, degree, year |
| Easy Apply defaults | Options Easy Apply tab | Work auth, sponsorship, relocate, salary, notice, country, start date, arrangement, how-heard, referral, visa, current role, EEO |
| Answer Bank | Options Answers tab + `profile.answerBank` | Unique Q&A from past apps; editable; synced with `customAnswers` |
| Auto years-of-experience | `resolveYearsOfExperience()` | From earliest `startDate` unless overridden |
| Import skills from experience | Skills tab button | Dedupes against existing skill names |
| Test skill match | Skills tab | Paste a JD snippet, see score / matched / gaps |
| Test resume match | Resumes tab | Rank all variants with confidence |
| Dirty-save indicator | Options header | “Unsaved changes” + Save profile |
| First/last name split | Personal tab + `mergePersonal()` | Full name splits; first+last rejoin |

### Extraction, matching, copy

| Feature | Where it lives | Notes |
|---------|----------------|-------|
| Job context extraction (F4) | `content/extract.ts` + site adapters | LinkedIn job, LinkedIn feed post, Greenhouse, Lever, generic |
| Selection as JD | Side panel “Add selection” | Replaces the current JD with the highlight |
| Skill matching (F5) | `lib/matcher.ts` | Keyword overlap weighted by skill level |
| Resume matching (F6) | `lib/matcher.ts` | Skills ×3, keywords ×2, role ×2, description overlap, priority tie-break |
| Template generation (F7) | `lib/generator.ts` | Fit paragraph, cover letter, cold email — no LLM |
| Copy / insert (F15) | `lib/clipboard.ts`, `content/insert.ts` | Clipboard + focused field / best textarea |
| Last job context cache | `chrome.storage.session` | Restored when side panel reopens |

### Autofill

| Feature | Where it lives | Notes |
|---------|----------------|-------|
| LinkedIn Easy Apply (F10) | `autofill/adapters/linkedin-easy-apply.ts` | Fills the open modal only; no Next/Submit; re-fills on step change |
| Generic + Greenhouse + Lever (F11) | `autofill/adapters/*` | Hostname routing |
| Field mapping | `lib/autofill-map.ts`, `field-mapper.ts` | autocomplete → name/id/label/placeholder |
| Empty-fields-only | Autofill engine | Unless **Force fill** is checked |
| Resume PDF attach attempt | `fillFileInput()` | DataTransfer + base64 PDF (side panel fill, not queue-started fill) |
| Answer Bank + custom answers | `lib/answers.ts`, `customAnswers` | Fuzzy question match; variants; Settings Answers tab |
| Unmapped / Needs you | `unmappedFields` + side panel footer | Save & fill writes the live control and the bank |
| AI leftover fields | `AI_ANSWER_FIELDS` / `lib/ai/fill-fields.ts` | Gemini `fill` / `ask` / `skip`; stored as `ai_suggested` |
| Form learner | `autofill/form-learner.ts` | Debounced blur/change; skips identity, password, certify |
| Certify / terms skip | `CERTIFY_QUESTION_RE` | Never auto-tick legal checkboxes |
| Queue Fill & apply | `lib/queue-apply.ts` | Opens URL + side panel + fill; does **not** mark applied |
| Apply session | `applykit_active_apply` | Mark applied / Mark applied & next |
| Content-script auto-inject | `lib/tab-messages.ts` | Re-injects if the tab was open before reload |

### Queue, mail, log

| Feature | Where it lives | Notes |
|---------|----------------|-------|
| LinkedIn post overlay (F12) | `content/post-overlay.ts` | 1-Click Save + Edit & Save on hiring posts |
| Smart hiring-post parser | `lib/post-parser.ts` | Unicode normalize, company/role/email/URL heuristics |
| AI post parse | Background `AI_PARSE_POST` | Gemini JSON extract; falls back to local parser |
| Mail/apply queue | `lib/queue.ts` | Types `linkedin_mail` and `job_scan` |
| Bulk delete | Options Queue tab | Select rows (or select all in view) and delete together |
| Dedup | `isQueueDuplicate()` | Same apply URL, or same email/company/role (not source post URL alone) |
| Job description on queue rows | `QueueItem.requirements` + `JobRequirementsPanel` | Expand ▸ on a row for technical requirements/expectations; full `description` stays for AI mail only |
| CSV export/import (F13) | `lib/csv.ts` | Quote-aware parser; merge by id or duplicate key |
| Mail send assist (F14) | `lib/mail-send.ts`, Gmail content script | Open Gmail compose + download PDF |
| Email composer modal | `EmailComposerModal.tsx` | Edit To/subject/body, pick resume, AI draft |
| Direct-link apply | Queue tab | **Fill & apply** opens URL(s) and fills; applied only after side-panel confirm |
| Activity log (F16) | `lib/activity-log.ts` | Cap 500 entries |
| Profile/queue backup (F17) | Options Backup tab | JSON + CSV; profile reset |

### AI (optional)

| Feature | Where it lives | Notes |
|---------|----------------|-------|
| Gemini generate (P3-1) | `lib/ai/gemini.ts` | Cover, email, fit paragraph |
| AI form-field fill | `lib/ai/fill-fields.ts` | Leftover application questions after local fill |
| AI job review | Side panel Match tab | apply / maybe / skip + reasons + risks |
| AI resume recommendation | Same review JSON | Optional “Switch to recommended” |
| Custom email system prompt | AI settings | Injected into content-mode prompt |
| Live model list | `fetchAvailableModels()` | From Gemini ListModels API |
| Model aliases | `MODEL_ALIASES` | Maps old Gemini 1.5/2.x IDs to 3.x |
| Request cache | `useAiGenerate` | Per job URL + profile timestamp + resume + mode |

### Cloud sync (optional)

| Feature | Where it lives | Notes |
|---------|----------------|-------|
| Private GitHub repo (P3-9) | `lib/github-repo-sync.ts` | Auto-creates `applykit-backup` |
| GitHub Gist | `lib/cloud-sync.ts` | Discovers existing ApplyKit gist |
| Read-only URL | `pullProfileFromUrl()` | Import-only |
| Resume PDF backup | Repo `resumes/pdf/{id}.pdf` or Gist base64 | Restored into IndexedDB on pull |
| Queue cloud sync | `queue.json` in repo | Push on every local queue write |
| Empty-profile guard | Push handlers | Refuses to overwrite a populated remote with empty local |
| Gist history recovery | `pullProfileFromGist()` | Walks gist revisions if latest is empty |
| Cloud-primary pull | `onStartup` + `useProfile` | Auto-pull when enabled |

---

## Small features (easy to miss)

These are implemented but easy to overlook:

- **Force fill** checkbox in the side panel footer overwrites already-filled form values.
- **Selection memory** in the content script and `chrome.storage.session` so highlighting a JD still works after the side panel steals focus. Add selection **replaces** the current description with the new highlight.
- **LinkedIn safety URL unwrapping** (`linkedin.com/safety/go/?url=…`) in the post parser.
- **Fancy Unicode normalization** (mathematical bold/sans-serif used in LinkedIn posts) before parsing.
- **Junk URL filter** drops WhatsApp, Telegram, YouTube, interview-kit, and similar links from apply URLs.
- **Multi-job posts** split into multiple queue rows (company+role blocks).
- **Queue filters** in Options: All / Send CV (email) / Direct link apps.
- **Fill #1, #2, …** buttons when a post has multiple apply URLs (each URL opens its own fill session).
- **Needs you** list in the side panel after fill, including after queue-started fill (`applykit_last_autofill`).
- **Answers** Options tab: search/edit/delete learned and AI-suggested Q&A (saved on blur).
- **GDrive link inject** into email body from the composer and from generator when `driveUrl` is set.
- **Show/hide** toggles for Gemini API key and GitHub token.
- **PING** handshake so the UI can detect a missing content script and inject it.
- **Restricted URL guard** (`chrome://`, `edge://`, extension pages) — no extract/fill/insert.
- **Fit paragraph** is generated even when the user never opens the Cover tab (feeds email templates).
- **Cover draft** in the side panel is what autofill inserts into cover-letter / additional-info fields.
- **Primary vs secondary button swap** in the footer: Easy Apply is primary on LinkedIn, Fill form is primary elsewhere.
- **Profile avatar initials** in the side panel header.
- **v0.2** badge in Options (package version is still `0.1.0` in `package.json` / manifest).

---

## Not implemented (still plan-only)

From `applykit/README.md` Phase 2 / 3, **not** in the current codebase:

- Speed Mode dashboard and keyboard war-room
- LinkedIn referral / Connect note assistant
- Full application tracker pipeline (interview / offer / rejected)
- Named templates with A/B rotation
- Gmail API draft-with-attachment (OAuth)
- Outlook adapter
- Ashby / Workday / Indeed adapters
- Auto-click Next on Easy Apply
- Encrypted backups
- PDF text extraction for matching
- Cross-device `chrome.storage.sync`

Queue and long JDs are stored in **`chrome.storage.local`**, not IndexedDB (IndexedDB is used only for resume PDF blobs). The product plan mentioned IndexedDB for the queue; the implementation does not.

---

## Quick map: user action → code

```
Options → Save profile     → saveProfile() → chrome.storage.local
                               → CLOUD_PUSH (if sync enabled)

Job page → Scan            → GET_JOB_CONTEXT → site adapter → JobContext
Side panel Match           → matchSkills() + matchResume()
Cover / Email              → generateContent() and/or AI_GENERATE

Fill Easy Apply            → AUTOFILL mode=easy_apply → LinkedIn modal → watch next step
Fill form                  → AUTOFILL mode=form → GH / Lever / generic
                           → leftover fields → AI_ANSWER_FIELDS → Needs you

LinkedIn feed 1-Click Save → AI_PARSE_POST or parseHiringPost() → addQueueItem()
Queue Compose & Send       → prepareMailSend() → Gmail tab + PDF download
Queue Fill & apply         → open URL + side panel + FILL_TAB_WHEN_READY (still pending)
                           → Mark applied / next in side panel after you Submit
Type on the form           → form learner → Answer Bank
Options Answers            → edit unique Q&A for the next application
```
