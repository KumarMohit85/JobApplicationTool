# Queue, LinkedIn capture, mail send, log, backup

How hiring posts become queue rows, how CSV and Gmail work, and how activity is recorded.

---

## Queue data model

`QueueItem` (`src/types/queue.ts`), stored as array key **`applykit_queue`** in `chrome.storage.local` (not IndexedDB).

| Field | Meaning |
|-------|---------|
| `id` | UUID |
| `type` | `linkedin_mail` (has/should have email) or `job_scan` (apply links / side-panel save) |
| `status` | `pending` \| `sent` \| `applied` |
| `email?` | Recruiter address |
| `applyUrl?` / `applyUrls?` | Direct apply links (multi-link posts) |
| `company`, `role` | Job labels |
| `description` | Full post/JD (up to 8000 chars) used internally for AI mail — **not shown in the queue table** |
| `requirements?` | Compact technical requirements + expectations for the expandable queue row (up to 2500 chars) |
| `phoneNumbers?` | Recruiter phone numbers (normalised digits, e.g. `"919737080195"`) |
| `whatsappNumbers?` | Subset of phone numbers confirmed to be WhatsApp contacts |
| `sourceUrl` | LinkedIn post or job URL |
| `resumeId?` | Last chosen variant |
| `createdAt`, `updatedAt` | ISO |

Normalize drops rows with no company, role, **and** sourceUrl. Unknown type becomes `job_scan`.

Every `saveQueueList` also sends `CLOUD_PUSH_QUEUE` so a connected GitHub repo updates `queue.json`.

### Dedup (`isQueueDuplicate`)

A candidate is a duplicate only if:

- It shares an **apply URL** with an existing row (tracking query params ignored), **or**
- Same recruiter **email** and the same **specific** company + role, **or**
- Same source post **and** the same specific company + role

The same LinkedIn post URL alone is **not** a duplicate — one post often lists several jobs. Placeholder names like “Hiring Company” / “Open Position” are ignored for company/role matching.

Each row stores a full `description` (up to 8000 characters) for AI/mail, and a separate `requirements` field with only technical requirements and expectations. The queue table does not dump the full post; click the ▸ control on a row to expand `JobRequirementsPanel`. Existing rows without `requirements` are filled from the stored description on read/write.

When extracting several jobs from one post, the full post/selection text is kept in `description` if the per-job summary is shorter, so Compose & Send / AI mail can use it. `requirements` stays scoped to that job when the parser/AI extracted a per-job block.

CRUD: `addQueueItem`, `updateQueueItem`, `deleteQueueItem`, `deleteQueueItems`, `importQueueItems` (added/updated/skipped counts), `replaceQueue`.

---

## LinkedIn post capture (F12)

### DOM read (`content/post-capture.ts`)

`findPostRoot()`: closest activity card from `document.activeElement`, else first post whose top is in the upper 60% of the viewport, else first post.

From the post:

- Full text → emails via `/[\w.-]+@[\w.-]+\.\w+/g`
- Role: hiring phrases, then a short list of common titles, else `"Software Engineer"`
- Company: “at/join” patterns, author headline `at X`, email domain (not gmail/yahoo/…), `@mention`
- Recruiter name from actor name selectors
- Permalink from `/feed/update/`, `activity`, `/posts/` anchors

Returns `null` if text is too short or there is no email/role/company signal.

### Overlay (`content/post-overlay.ts`)

Only on URLs matching `linkedin.com/(feed|posts|in/|search/results/content|detail)`.

Hiring hint regex: hiring, opening, mail resume, apply @, etc.

**1-Click Save** (`quickSavePost`):

1. `AI_PARSE_POST` with post text
2. Else `parseHiringPost()`
3. Else if a single email exists, enqueue one `linkedin_mail`
4. Else open the edit modal (email required)

Each parsed job: `linkedin_mail` if email present, else `job_scan` with `applyUrl`(s). Toast: `Queued N job(s)! (M dups)`.

**Edit & Save** always opens the modal (email, company, role) and saves one mail row.

### Smart local parser (`lib/post-parser.ts`)

Used when AI is off or Gemini fails.

1. **Unicode fold** — mathematical bold/italic/sans-serif/monospace letters and digits → ASCII (LinkedIn “fancy” hiring posts)
2. Unwrap `linkedin.com/safety/go/?url=`
3. Split lines into **blocks** when the company name changes
4. Skip pure noise lines (repost, follow-for-more, interview-kit); WhatsApp/Telegram lines that contain phone numbers are **kept** so recruiter contacts are extracted
5. Company: known-company list, regex patterns (`X is hiring`, `at X`, markdown `[Name](url)`, `@handle`), else email domain
6. Role: long `ROLE_PATTERNS` list then `Role: …` / `hiring for …`
7. Apply URLs: http(s) minus social/junk (WhatsApp, YouTube, Instagram, and context words like `interview_kit`, `roadmap`)
8. Fallback single row if any email or apply URL exists
9. `extractJobRequirements()` keeps only Requirements / Responsibilities (or similar) sections for the queue expand panel
10. `isHiringText()` gates the side-panel extract UI

---

## Side panel extract → queue

Context tab, when the JD looks like a hiring post: **Extract jobs** then queue one or all. Same `addQueueItem` fields as 1-Click Save. Side panel **Save to queue** is a simpler path: current `JobContext` as one `job_scan` (no email required).

Popup **Save LinkedIn post** is the review-then-confirm path (single email row).

---

## Queue tab UI

`components/options/QueueTab.tsx`

- Counts: total, email apps, link apps, WhatsApp contacts
- Filters: All / Send CV (email or `linkedin_mail`) / Direct link (`applyUrl` and no email) / **WhatsApp** (rows with phone or WhatsApp numbers)
- Table: checkbox, expand control, category badge, company, role, mailto + apply links, **status `<select>`**, actions
- **▸ / ▾** on each row expands `JobRequirementsPanel` — technical requirements and expectations only (not hashtags, apply instructions, or the full post)
- **Select multiple** + **Delete selected** (also header “select all” for the current filter)
- Status change to `sent` or `applied` appends activity log
- **Compose & Send** (email rows) opens `EmailComposerModal` using the stored job `description` for AI subject/body
- **Send CV on WA** / **WA #n** (rows with WhatsApp or phone numbers) — opens `https://wa.me/{digits}?text=…` with a short intro pre-filled; user attaches the resume PDF and taps Send (never auto-sends). Implemented in `lib/whatsapp-compose.ts`.
- **Fill & apply** / **Fill #n** opens that URL, the side panel, and autofill when the page is ready. Status stays `pending` until **Mark applied** in the side panel (or a manual status change). See [form-fill.md](./form-fill.md).
- Delete (single row or bulk)
- Export CSV (all rows) / Import CSV

---

## CSV export / import (F13)

`lib/csv.ts` — no Papa Parse.

Headers: `id,type,status,email,company,role,description,requirements,applyUrl,applyUrls,phoneNumbers,whatsappNumbers,sourceUrl,resumeId,createdAt,updatedAt`

Array fields (`applyUrls`, `phoneNumbers`, `whatsappNumbers`) are pipe-separated (`|`) in CSV cells. Backward-compatible — old CSV files without these columns still import cleanly.

- Fields with `,` `"` or newlines are quoted; quotes doubled
- Parser is a state machine (handles `""` inside quotes)
- Import: merge by existing `id`; else skip duplicates; else add
- `downloadCsv` uses Blob+anchor or `chrome.downloads`

Also on Backup tab: export all or import queue; Queue tab export is all items (Backup can export pending-only is **not** on Queue tab — Queue exports full list; Backup “Export queue CSV” is also full list). The Queue tab’s `exportCsv(pendingOnly)` helper exists but the button always calls `exportCsv(false)`. Pending-only is unused in the UI.

---

## Mail send assist (F14)

### Composer modal (`EmailComposerModal.tsx`)

- To (prefilled from queue), From (display of profile email — **not** sent to Gmail SMTP; Gmail uses the logged-in account)
- Subject default: `Application for {role} — {name}`
- Body default: template with summary + optional Drive link
- Resume dropdown; choosing a variant with `driveUrl` appends the link if missing
- **Auto-fill with AI** / **AI Generate Body** → `AI_GENERATE` mode `content`
- **Open Gmail & Send** → `prepareMailSend(item, body, subject)`

On success: activity `email_sent`, parent sets status `sent` and stores email/resumeId.

### `prepareMailSend` (`lib/mail-send.ts`)

1. Require `item.email`
2. Build a synthetic `JobContext` from the row
3. Rule-based `matchSkills` + resume (row `resumeId` or matcher)
4. `generateContent` unless the modal already passed override subject/body (overrides win)
5. Write `PendingCompose` to **session** storage
6. `downloadResumePdf` (best effort) so the file is in Downloads
7. `chrome.tabs.create` Gmail compose URL:

   `https://mail.google.com/mail/?view=cm&fs=1&to=&su=&body=`

Gmail URL params cannot attach files. Limitation is documented in the product README.

### Gmail content script

`gmail-index.ts` on `mail.google.com`:

- On load, read pending compose; try fill immediately and after 1200ms / 2500ms
- On success, **remove** the session key (so refresh does not refill)
- Also handles `FILL_GMAIL_COMPOSE` if sent later

`gmail-fill.ts` finds compose dialog (role=dialog / `.AD` / `.nH`):

- To: `input[name=to]`, `textarea[name=to]`, aria-label To
- Subject: `subjectbox` / `subject` / aria-label
- Body: `div[aria-label=Message Body]`, `g_editable` textbox
- Sets values with input/change; body via `execCommand('selectAll'+'insertText')`

User still clicks Gmail **Send** and still **attaches** the downloaded PDF (or uses the Drive link in the body).

---

## Activity log (F16)

`lib/activity-log.ts`, key `applykit_activity_log`, **max 500** entries (newest first).

| `action` | When |
|----------|------|
| `easy_apply_fill` | Side panel Easy Apply filled ≥1 field |
| `form_fill` | Side panel or popup form fill ≥1 field |
| `email_sent` | Composer send success or queue status → sent |
| `job_applied` | Queue status → applied or side panel **Mark applied** |
| `queued` | Side panel Save to queue |

Fields: company, role, url, optional resume id/name, timestamp.

Options **Activity log** tab: table, Refresh, Clear (confirm). Popup form_fill currently logs empty company/role/url.

---

## Backup (F17)

`BackupTab.tsx`

- Export / import profile JSON (import marks Options dirty; user must Save)
- Export / import queue CSV
- **Download profile + queue** (two files, date-stamped `YYYY-MM-DD`)
- **Reset profile** (confirm) → `clearProfile` + reload
- Shows `profile.updatedAt`

PDFs are **not** in the JSON backup; they live in IndexedDB or GitHub cloud sync. The copy in the tab says to re-upload after a fresh install if cloud sync is unused.

`downloadJson` / `downloadCsv` work in the Options page via Blob URLs.
