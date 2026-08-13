# ApplyKit

Chrome extension to apply to jobs, send tailored emails, and request LinkedIn referrals with **minimum clicks**. One local profile + multiple resumes; the extension matches skills and resume variants to each job description.

**North-star:** in about **1 hour**, process ~**150–200 touches** (LinkedIn Easy Apply, ATS forms, LinkedIn-post emails, later referrals) when the queue is prepped.

This document is the product + engineering plan: **MVP vs later phases**, **what to use**, and **how each feature works**.

---

## Table of contents

1. [Product goal](#1-product-goal)
2. [How it works (end-to-end)](#2-how-it-works-end-to-end)
3. [Tech stack](#3-tech-stack)
4. [Project structure](#4-project-structure)
5. [Data models](#5-data-models)
6. [MVP features](#6-mvp-features)
7. [Phase 2 features](#7-phase-2-features)
8. [Phase 3 features](#8-phase-3-features)
9. [Site adapters](#9-site-adapters)
10. [Permissions](#10-permissions)
11. [Privacy & safety](#11-privacy--safety)
12. [Build order](#12-build-order)
13. [Throughput reality](#13-throughput-reality)
14. [Open decisions](#14-open-decisions)

---

## 1. Product goal

Store your professional data once. On any job page, LinkedIn post, or email compose screen:

- Extract **company, role, job description**
- Match **skills** and the **right resume PDF** (each PDF has a description of what it is for)
- Generate **cover letter / email body / Easy Apply answers**
- **Autofill** forms (LinkedIn Easy Apply + Greenhouse/Lever/generic)
- Save LinkedIn hiring posts (email + company + role + JD) to a **local CSV/queue**
- Later: send that mail with body + matching resume attached, in a few clicks

**User always clicks Send / Submit.** The extension never auto-submits.

---

## 2. How it works (end-to-end)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Profile +  │     │  Page / post     │     │  Matcher +      │
│  resumes    │────▶│  context         │────▶│  templates      │
│  (local)    │     │  (content script)│     │  (side panel)   │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
           ┌──────────────────┬───────────────────────┼───────────────┐
           ▼                  ▼                       ▼               ▼
    Easy Apply fill     ATS form fill         Mail queue send    Referral note
    (LinkedIn modal)    (GH / Lever / any)    (Gmail + PDF)     (Phase 2)
```

### Main user flows

| Flow | Trigger | Result |
|------|---------|--------|
| **Setup** | Options page | Profile, skills, Easy Apply defaults, resume PDFs + descriptions |
| **LinkedIn Easy Apply** | Job page → Easy Apply modal | Autofill steps + cover snippet; you Submit |
| **ATS / generic apply** | Greenhouse, Lever, or any apply form | Fill empty fields; you Submit |
| **LinkedIn post → queue** | Post that includes an email | Save email, company, role, JD locally |
| **Mail send** | Dashboard row → Send | Generate body, pick resume, open Gmail compose + PDF ready |
| **Referral connect** (Phase 2) | Company / job on LinkedIn | Draft ≤300 char note; you click Send |

### Speed target (after Phase 2 Speed Mode)

| Action | Target time | Notes |
|--------|-------------|--------|
| LinkedIn-post email | ~15 sec | Pre-generated body + resume match |
| Simple Easy Apply | ~20–40 sec | Multi-step; you click Next/Submit |
| Greenhouse / Lever | ~20–40 sec | File upload may be extra click |
| Referral connect | ~15–25 sec | LinkedIn weekly limits apply |
| Workday / long forms | minutes | Skip or “later” bucket |

---

## 3. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Extension format | **Manifest V3** | Required for new Chrome extensions |
| Language | **TypeScript** | Safer data models (profile, queue, resumes) |
| UI | **React** | Shared components: popup, side panel, options, dashboard |
| Build | **Vite + WXT** (preferred) or `@crxjs/vite-plugin` | HMR, multi-entry (background, content, UI) |
| Styling | **Tailwind CSS** | Fast, consistent UI |
| Local DB | **IndexedDB** (via `idb`) | Queue + long JDs; larger than `chrome.storage` |
| Small settings | **`chrome.storage.local`** | Profile flags, defaults, last resume id |
| CSV | Papa Parse (or small custom) | Export / import mail queue |
| Matching (MVP) | Custom TS: keyword + TF-IDF-ish overlap | Offline, private, no API |
| Email compose (MVP) | Gmail content script + `mailto` fallback | No OAuth yet |
| PDF storage | IndexedDB blobs + download on send | Chrome cannot silently attach to Gmail in MVP |
| LLM (Phase 3) | User API key (OpenAI / Anthropic) in storage | Optional; never hardcoded |
| Gmail attach (Phase 3) | Gmail API OAuth → draft with attachment | True one-click attach |

**Not in MVP:** backend server, cloud sync, paid email-finder APIs.

---

## 4. Project structure

```
applykit/
├── README.md
├── package.json
├── wxt.config.ts                 # or vite.config.ts
├── manifest.ts                   # MV3 manifest (WXT) / manifest.json
├── public/icons/
└── src/
    ├── background/
    │   └── service-worker.ts     # messages, queue, downloads
    ├── content/
    │   ├── index.ts              # router by hostname
    │   ├── linkedin/
    │   │   ├── post-capture.ts   # save post → queue
    │   │   ├── easy-apply.ts     # Easy Apply modal
    │   │   ├── job-page.ts       # extract title / company / JD
    │   │   └── connect.ts        # Phase 2: connection note inject
    │   ├── autofill/
    │   │   ├── engine.ts         # fill + dispatch input events
    │   │   ├── field-mapper.ts   # label/name → profile key
    │   │   └── adapters/
    │   │       ├── greenhouse.ts
    │   │       ├── lever.ts
    │   │       └── generic.ts
    │   └── gmail/
    │       └── compose.ts        # inject to / subject / body
    ├── sidepanel/                # review, match, fill, insert
    ├── popup/                    # quick actions
    ├── options/                  # profile, resumes, defaults, CSV
    ├── dashboard/                # Phase 2: Speed Mode / mail queue UI
    │                             # MVP: mail queue can live in options
    ├── lib/
    │   ├── profile.ts
    │   ├── resumes.ts
    │   ├── matcher.ts            # skills + resume vs JD
    │   ├── generator.ts          # templates → text
    │   ├── queue.ts              # IndexedDB queue
    │   ├── csv.ts                # export / import
    │   ├── autofill-map.ts       # field aliases
    │   └── log.ts                # apply / mail log
    └── types/
        └── index.ts
```

---

## 5. Data models

### 5.1 Profile

```ts
type Profile = {
  personal: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    linkedIn: string;
    github: string;
    portfolio: string;
    headline: string;
  };
  summary: string;
  skills: { name: string; level: "beginner" | "intermediate" | "expert"; keywords: string[] }[];
  experience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string | "present";
    bullets: string[];
    technologies: string[];
  }[];
  education: { school: string; degree: string; year: string }[];
  easyApplyDefaults: {
    authorizedToWork: "Yes" | "No";
    requiresSponsorship: "Yes" | "No";
    yearsOfExperience?: number; // or derived from experience
    willingToRelocate: "Yes" | "No";
    expectedSalary?: string;
    noticePeriod?: string;
    customAnswers: Record<string, string>;
  };
};
```

### 5.2 Resume variant

Each PDF has **text describing what it is for**. Matcher uses that + skills + JD.

```ts
type ResumeVariant = {
  id: string;
  name: string;                 // e.g. "Full Stack – Mohit"
  fileName: string;             // e.g. "Mohit_Pal_FullStack.pdf"
  blobKey: string;              // IndexedDB key for PDF bytes
  description: string;          // "Full-stack React/Node… best for startup FS roles"
  skills: string[];
  keywords: string[];           // "full stack", "mern", "backend"
  targetRoles: string[];
  priority: number;             // tie-breaker
};
```

### 5.3 Mail / apply queue row (CSV columns)

Local source of truth: **IndexedDB**. CSV is export/import.

| Column | Example | Notes |
|--------|---------|--------|
| `id` | uuid | |
| `type` | `linkedin_mail` \| `easy_apply` \| `ats_apply` | |
| `email` | `careers@acme.com` | Required for mail rows |
| `company` | `Acme Inc` | |
| `role` | `Senior Frontend Engineer` | |
| `job_description` | full text | Used for body + resume match |
| `source_url` | LinkedIn post or job URL | |
| `captured_at` | ISO timestamp | |
| `status` | `pending` \| `sent` \| `applied` \| `skipped` | |
| `matched_resume_id` | `resume-fullstack-v2` | Set at send/apply time |
| `generated_subject` | | Optional cache |
| `generated_body` | | Optional cache |
| `sent_at` / `applied_at` | | |
| `notes` | skip reason, etc. | |

### 5.4 Generated output (per job)

```ts
type GeneratedPacket = {
  jobContext: { title: string; company: string; url: string; descriptionText: string };
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  resumeId: string;
  resumeConfidence: number;
  outputs: {
    fitParagraph: string;
    coverLetter: string;
    coldEmail: { subject: string; body: string };
  };
};
```

---

## 6. MVP features

Everything below ships in **v1**. Implementation notes say **what to use** and **how it works**.

### F1 — Profile storage

- **What:** Name, contact, links, summary, experience, education, Easy Apply defaults.
- **Use:** `chrome.storage.local` for profile JSON; Options page (React) to edit.
- **How:** CRUD in `lib/profile.ts`. Export/import JSON backup. Never overwrite typed form fields unless “Force fill”.

### F2 — Skills library

- **What:** Skills with level + extra keywords (e.g. React → `reactjs`, `frontend`).
- **Use:** Same profile object; editable list in Options.
- **How:** Matcher scores JD against `name + keywords`, weighted by `level`.

### F3 — Resume library (multiple PDFs + descriptions)

- **What:** Upload several PDFs; each has a description of what that resume is about.
- **Use:** IndexedDB for binary PDFs; metadata in `chrome.storage.local` or same IDB store.
- **How:** Options → Resumes tab: upload, paste description, skills, target roles. “Test match”: paste a JD, see which resume wins.

### F4 — Page / job context extraction

- **What:** Job title, company, description from current tab.
- **Use:** Content scripts + site adapters; fallback = user text selection.
- **How:**
  1. LinkedIn job page: dedicated selectors in `job-page.ts`.
  2. Greenhouse/Lever: title + description containers.
  3. Generic: `document.title` + largest text near “description” / “requirements”.
  4. Manual: “Use selection as job description” in side panel.

### F5 — Skill matching

- **What:** Score your skills vs JD; list gaps.
- **Use:** `lib/matcher.ts` (normalize, tokenize, overlap). No API in MVP.
- **How:** Lowercase JD, strip HTML. For each skill, hit name + keywords. Weight expert > beginner. Output matched + missing.

### F6 — Resume matching

- **What:** Pick the best PDF from JD + role + each resume’s **description**.
- **Use:** Same matcher module.
- **How:**

```
score(resume, jd, role) =
    skill_overlap(resume.skills, jd) * 3
  + keyword_hits(resume.keywords, jd) * 2
  + role_similarity(resume.targetRoles, role) * 2
  + text_overlap(resume.description, jd) * 1
```

Show winner + confidence + dropdown override in side panel. Remember last override per company (nice-to-have in MVP if cheap).

### F7 — Template text generation

- **What:** Fit paragraph, cover letter, email subject + body from profile + match + JD keywords.
- **Use:** `lib/generator.ts` + Mustache-style placeholders: `{{company}}`, `{{role}}`, `{{topMatchedSkills}}`, `{{yourName}}`.
- **How:** Fill templates; trim email to a readable length. User edits in side panel before insert/send. **No LLM in MVP.**

Example cold / LinkedIn-post email:

```
Subject: Application for {{role}} — {{yourName}}

Dear Hiring Team,

I am writing to apply for the {{role}} position at {{company}}.
I saw your LinkedIn post and believe my background in {{topMatchedSkills}}
aligns with what you described.

{{fitParagraph}}

Please find my resume attached. I would welcome a conversation.

Best,
{{yourName}}
{{phone}} | {{linkedIn}}
```

### F8 — Side panel UI

- **What:** Main “review then act” surface.
- **Use:** Chrome **Side Panel API**; React.
- **How:** Tabs: Context | Match | Cover | Email. Buttons: **Fill Easy Apply**, **Fill form**, **Copy**, **Insert**, **Save to queue**. Resume picker + confidence bar.

### F9 — Popup quick actions

- **What:** Toolbar icon: open side panel, fill form, save LinkedIn post, open Options.
- **Use:** Chrome popup (small React app).
- **How:** `chrome.runtime.sendMessage` / `chrome.sidePanel.open`.

### F10 — LinkedIn Easy Apply (MVP must-have)

- **What:** When Easy Apply modal is open, fill fields across steps + insert cover letter; you Submit.
- **Use:** Content script `easy-apply.ts` + MutationObserver + shared autofill engine.
- **How:**
  1. Detect apply dialog (`[role="dialog"]` + LinkedIn-specific markers; selectors live in one config file so they are easy to update).
  2. Extract job title/company/JD from the job page (already open).
  3. Match resume + generate cover snippet.
  4. On each wizard step, scan inputs/selects/textareas.
  5. Map labels (`aria-label`, `<label>`, placeholder) → profile / `easyApplyDefaults`.
  6. Fill **empty** fields only; dispatch `input` + `change` (React-friendly).
  7. Cover / additional-info textarea → insert generated text.
  8. File input: if present, try to set matched PDF; else toast “Choose Mohit_Pal_FullStack.pdf” (name hint) or auto-download PDF.
  9. Re-run on step change. **Do not auto-click Next or Submit.**
  10. Log company, role, URL, resume id, timestamp.

**LinkedIn resume UX (MVP):** LinkedIn often reuses previously uploaded files. Prefer: (A) programmatic file input when visible, (B) hint which stored resume to pick, (C) download PDF + user selects once.

### F11 — Generic + ATS autofill (MVP must-have)

- **What:** Fill name, email, phone, location, LinkedIn, GitHub, website, cover letter, common dropdowns.
- **Use:** `autofill/engine.ts` + `field-mapper.ts` + adapters: **Greenhouse**, **Lever**, **generic**.
- **How:**
  1. Detect site by hostname.
  2. Collect visible form controls.
  3. Resolve field type via `autocomplete` → `name`/`id` → label → placeholder.
  4. Lookup value from profile / defaults.
  5. Fill empty fields; toast “Filled N fields”.
  6. Unmapped / custom questions: list in side panel with **Insert** into focused field.

**Trigger:** popup “Fill form on this page”, or side panel button. Optional: prompt when ≥5 mappable apply fields are detected.

### F12 — LinkedIn post capture → local queue

- **What:** On a LinkedIn post that includes an email (“mail resume to …”), save **email, company, role, job description**.
- **Use:** Content script `post-capture.ts`; email regex; IndexedDB via background; CSV export in Options.
- **How:**
  1. Overlay / button on post: **Save to mail queue**.
  2. Detect emails: `/[\w.-]+@[\w.-]+\.\w+/`.
  3. Heuristics: role from “hiring / opening / position”; company from @mention, “at X”, or tagged company.
  4. Pre-fill a small edit form (email required); user confirms.
  5. Deduplicate: same `email + company + role` or same `source_url`.
  6. Store row `type: linkedin_mail`, `status: pending`.

### F13 — CSV export / import

- **What:** Download queue as CSV; re-import after editing in Excel/Sheets.
- **Use:** `lib/csv.ts`; `chrome.downloads` or `<a download>`.
- **How:** IndexedDB is source of truth. Export all or `pending` only. Import merges by `id` or email+company+role.

### F14 — Mail send assist (generate + resume + Gmail)

- **What:** From a queue row: generate body from JD, pick resume, open compose, get PDF ready.
- **Use:** Generator + matcher + Gmail content script (`mail.google.com`) + `chrome.downloads` for PDF.
- **How:**
  1. User clicks **Send** on a row (Options mail queue in MVP; dashboard later).
  2. Matcher picks resume; user can override.
  3. Generator builds subject + body from JD + resume description + profile.
  4. Open Gmail compose (new tab or inject into existing compose).
  5. Fill **To, Subject, Body**.
  6. Download matched PDF with a stable filename.
  7. Toast: “Attach `Mohit_Pal_FullStack.pdf` (downloaded) then Send”.
  8. User attaches + clicks Send; then **Mark sent** (or detect later in Phase 2).

**Limitation:** `mailto:` and Gmail URL params **cannot attach files**. MVP = pre-fill + download PDF (one extra attach click). Full attach = Phase 3 Gmail API.

### F15 — Insert / copy on page

- **What:** Paste generated text into focused textarea / contenteditable.
- **Use:** Content script + `document.execCommand('insertText')` or InputEvent.
- **How:** Side panel **Insert** → message to tab. **Copy** always works as fallback (`navigator.clipboard`).

### F16 — Basic activity log

- **What:** Local list: applied / emailed (company, role, URL, date, resume used).
- **Use:** IndexedDB `log` store; simple table in Options.
- **How:** Write on Fill Easy Apply / Mark sent / Fill form. Enough to avoid double applying; full tracker UI is Phase 2.

### F17 — Profile / queue backup

- **What:** Download profile JSON + queue CSV.
- **Use:** Options buttons.
- **How:** No encryption in MVP. Do not commit PDFs or `.env` to git.

---

## 7. Phase 2 features

Quality-of-life + volume. Build after MVP is usable daily.

### P2-1 — Application tracker (full)

- Status pipeline: applied → interview → offer / rejected.
- Filter by company, source (`linkedin_mail`, Easy Apply, ATS).
- Notes per application.

### P2-2 — Named email / cover templates

- Multiple templates with placeholders.
- Rotate A/B/C to avoid identical spam patterns.

### P2-3 — Resume variants as first-class “tracks”

- e.g. Frontend-heavy vs Backend-heavy vs Full-stack; auto-pick already in MVP, UI polish here.

### P2-4 — Speed Mode / war-room dashboard

- Full-screen queue: 200 items, timer, `147/200`, next 5 preview.
- Keyboard: `Enter` = done & next, `A` = autofill, `E` = email, `R` = referral, `S` = skip, `U` = undo.
- Auto-advance to next URL after mark done.
- Sort **fast sites first** (Greenhouse before Workday).
- Pause / resume session.

**Use:** extra extension page (`dashboard.html`) or side panel expanded; `background/tab-orchestrator.ts` to open/switch tabs.

### P2-5 — CSV / spreadsheet bulk import (any jobs, not only LinkedIn posts)

- Columns: company, role, URL, type (`email` | `apply` | `referral`), contact email, LinkedIn URL.
- Dedupe against log.

### P2-6 — Batch pre-generation

- Before a session, generate subject/body/cover/referral note for all pending rows.
- Session then is review + Send only (~15 sec/item).

### P2-7 — Tab harvest

- “Add all open job tabs to queue”.
- LinkedIn job search: “Add visible jobs”.

### P2-8 — Smart skip bucket

- Keys: captcha, login wall, long form, already applied.
- Heavy forms go to “Apply later” without blocking the hour.

### P2-9 — Gmail / Outlook inject polish

- Dedicated compose buttons: **Insert ApplyKit email**.
- Outlook.com adapter if needed.

### P2-10 — Keyboard shortcut

- e.g. `Alt+J` open side panel (`commands` in manifest).

### P2-11 — More ATS adapters

- Ashby, Workday (best-effort), Indeed apply where possible.

### P2-12 — LinkedIn referral connection assistant

- **What:** Find employees at target company; draft connection note asking for referral; user Send.
- **Use:** Content scripts on `linkedin.com/company/*/people`, `/in/*`, people search; `referral-generator.ts`.
- **How:**
  1. From job or company page, build People search URL or parse visible people cards.
  2. Filters: Recruiter / Engineer / Manager.
  3. Generate note ≤ **300 characters** from profile + role + company + matched skills.
  4. Open Connect → Add a note → fill textarea. **User clicks Send.**
  5. Log: person, title, company, note, status (`sent` / `accepted` / `replied` / `referred`).
  6. Daily cap (default 40) + cooldown warning.
  7. Optional queue: 3–5 people, Next after each send.

**Do not auto-click Send.** LinkedIn ToS + ban risk.

### P2-13 — Referral follow-up template

- After accept, suggest DM text (paste into LinkedIn messaging).

### P2-14 — Duplicate / cooldown guard

- Don’t suggest a profile contacted in last N days.

### P2-15 — Mail queue: auto mark sent (best effort)

- Detect Gmail send or require one click “Mark sent” still.

### P2-16 — Remember resume override per company

### P2-17 — LinkedIn Easy Apply: “Fill all steps” helper

- Still no auto-Submit; auto-advance Next only if user enables an explicit risky toggle (default off).

---

## 8. Phase 3 features

Advanced / optional. Do not block daily use.

### P3-1 — LLM generation

- User-supplied OpenAI/Anthropic key in `chrome.storage.local`.
- Batch API: generate all 200 custom paragraphs before session.
- Optional: LLM picks resume id + 2-line reason.

### P3-2 — Gmail API: draft with attachment

- OAuth; create draft with To/Subject/Body + matched PDF.
- User opens draft → Send. Closest to true one-click attach.

### P3-3 — Email finder APIs

- Hunter / Apollo to fill `to:` for cold outreach (not LinkedIn-post emails).

### P3-4 — Native messaging helper (optional)

- Tiny local app to attach files if Gmail API is undesirable.

### P3-5 — Multi-tab preload

- Open next 3 target tabs while working on current.

### P3-6 — Bulk “save all posts with emails on this feed”

### P3-7 — Referrer scoring

- Recruiter > hiring manager > same-skill engineer > other.

### P3-8 — Alumni / mutual connection hints

### P3-9 — Sync across devices

- `chrome.storage.sync` (size limits) or encrypted backup file / optional backend.

### P3-10 — Analytics

- Local stats: applications/day, response rate (manual status).

### P3-11 — Encrypted CSV / backup password

### P3-12 — PDF parse of resume (optional)

- Extract text from PDF for richer matching; MVP uses your written description instead.

---

## 9. Site adapters

| Priority | Site | MVP | Later |
|----------|------|-----|--------|
| P0 | Any page (generic extract + fill) | Yes | |
| P0 | LinkedIn job + **Easy Apply** | Yes | Robust selectors |
| P0 | LinkedIn feed/post capture | Yes | Bulk save |
| P0 | Greenhouse | Yes | |
| P0 | Lever | Yes | |
| P1 | Gmail compose | Yes (inject) | Gmail API attach |
| P2 | LinkedIn People / Connect | | Referral assistant |
| P2 | Indeed | | Extract + apply where possible |
| P3 | Workday, Ashby, Outlook | | Best-effort |

LinkedIn UI changes often: keep **all selectors in one config** per adapter, not scattered in components.

---

## 10. Permissions

MVP `manifest` (narrow hosts):

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "activeTab",
    "sidePanel",
    "scripting",
    "downloads"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://boards.greenhouse.io/*",
    "https://job-boards.greenhouse.io/*",
    "https://jobs.lever.co/*",
    "https://mail.google.com/*"
  ]
}
```

Phase 2+ may add `tabs`, `commands`, extra ATS hosts, `identity` (Gmail OAuth).

Prefer **user-gesture** (`activeTab` + click) where possible to reduce install warnings.

---

## 11. Privacy & safety

- **All data local** in MVP (IndexedDB + `chrome.storage.local`). No server.
- API keys (Phase 3) stay in local storage; never in the repo.
- **Never auto-click LinkedIn Send or application Submit.**
- LinkedIn referral: daily cap + disclaimer (ToS / rate limits).
- Autofill: empty fields only unless Force fill.
- Do not scrape behind login beyond what the user already sees in their tab.
- PDFs and CSV may contain PII: `.gitignore` uploads / local data dirs.

---

## 12. Build order

| Week | Scope | Features |
|------|--------|----------|
| **1** | Scaffold WXT/Vite MV3, Options UI | F1, F2, F3, F17 |
| **2** | Matcher, generator, side panel, popup | F4–F9, F15 |
| **3** | Autofill engine + GH/Lever/generic + **LinkedIn Easy Apply** | F10, F11 |
| **4** | Post capture, queue, CSV, Gmail send assist, log | F12–F16 |

**Phase 2** after daily use: Speed Mode, referrals, tracker, batch pre-gen.  
**Phase 3:** LLM, Gmail API attach, email finder.

---

## 13. Throughput reality

| Claim | Reality |
|-------|---------|
| 200 Workday apps / hour | No |
| 200 LinkedIn connection requests / day | Unsafe; weekly caps (~100/week typical) |
| 200 mixed **touches** / hour | Yes, after Phase 2 Speed Mode + pre-gen |
| MVP Easy Apply rate | ~40–60 simple Easy Applies / hour if questions are standard |
| LinkedIn-post emails (MVP) | ~15–25 sec after queue is filled (attach PDF still one click) |

Example **1-hour mix (Phase 2)**: ~100 LinkedIn-post emails + ~50 Easy Apply/ATS + ~30–40 referral connects (capped) + skip bucket.

---

## 14. Open decisions

Defaults if unspecified:

| Topic | Default |
|-------|---------|
| Product name | **ApplyKit** |
| LinkedIn resume upload | Try file input; else hint + download PDF |
| Gmail attach (MVP) | Compose pre-fill + auto-download PDF |
| CSV | IndexedDB + export/import (not a fixed disk folder) |
| Matching | Rule-based; LLM in Phase 3 |
| Mark sent | Manual click |
| Duplicate posts | Separate rows if same email but different **role** |
| Referral automation | Assist only (user Send) |
| Easy Apply Next/Submit | Never auto-click in MVP |

---

## Feature index (quick reference)

### MVP

| ID | Feature |
|----|---------|
| F1 | Profile storage |
| F2 | Skills library |
| F3 | Resume library (PDF + description) |
| F4 | Job / page context extraction |
| F5 | Skill matching |
| F6 | Resume matching from JD + descriptions |
| F7 | Template generation (cover + email) |
| F8 | Side panel |
| F9 | Popup |
| F10 | **LinkedIn Easy Apply autofill** |
| F11 | **Generic + Greenhouse + Lever autofill** |
| F12 | LinkedIn post → queue (email, company, role, JD) |
| F13 | CSV export / import |
| F14 | Mail send assist (Gmail + PDF ready) |
| F15 | Insert / copy |
| F16 | Basic activity log |
| F17 | Backup export |

### Phase 2

| ID | Feature |
|----|---------|
| P2-1 | Full application tracker |
| P2-2 | Named templates + rotation |
| P2-3 | Resume track polish |
| P2-4 | Speed Mode dashboard + keyboard |
| P2-5 | Bulk CSV import (all job types) |
| P2-6 | Batch pre-generation |
| P2-7 | Tab / search harvest |
| P2-8 | Smart skip / later bucket |
| P2-9 | Gmail/Outlook inject polish |
| P2-10 | Global keyboard shortcut |
| P2-11 | More ATS adapters |
| P2-12 | LinkedIn referral connection assistant |
| P2-13 | Referral follow-up DM template |
| P2-14 | Outreach cooldown / dedupe |
| P2-15 | Auto mark sent |
| P2-16 | Per-company resume memory |
| P2-17 | Easy Apply multi-step helper (still no auto-Submit) |

### Phase 3

| ID | Feature |
|----|---------|
| P3-1 | LLM body + resume pick |
| P3-2 | Gmail API draft + attachment |
| P3-3 | Email finder APIs |
| P3-4 | Native messaging attach helper |
| P3-5 | Multi-tab preload |
| P3-6 | Bulk LinkedIn feed capture |
| P3-7 | Referrer scoring |
| P3-8 | Alumni / mutual hints |
| P3-9 | Cross-device sync |
| P3-10 | Local analytics |
| P3-11 | Encrypted backup |
| P3-12 | PDF text parse |

---

## Development

```bash
cd applykit
npm install
npm run dev      # watch build → load dist/ in chrome://extensions
npm run build    # production build
```

**Load in Chrome:** `chrome://extensions` → Developer mode → Load unpacked → select `applykit/dist`.

---

## Implementation status

| Feature | Status |
|---------|--------|
| **Scaffold** (Vite + CRXJS + React + Tailwind) | Done |
| **F1** Profile storage + Options UI | Done |
| **F2** Skills library | Done |
| **F3** Resume library (PDF + descriptions) | Done |
| **F4** Page / job context extraction | Done |
| **F5** Skill matching (side panel) | Done |
| **F6** Resume matching (side panel) | Done |
| **F7** Template generation | Next |
| **F8–F17** | Pending |

---

## Next step

Continue MVP **one feature at a time**. Next up: **F7 — Template generation** (cover letter + email snippets in side panel).
