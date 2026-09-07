# UI surfaces

ApplyKit has three Chrome UI pages plus in-page overlays. Each is a separate React app.

---

## Options page (profile & ops)

**Entry:** `src/options/index.html` → `App.tsx`  
**Opened:** popup “Profile settings”, side panel ⚙️ Settings, or chrome://extensions → Details → Extension options. Manifest: `open_in_tab: true`.

### Shell

- Brand header (ApplyKit **v0.2** badge — independent of `package.json` `0.1.0`)
- Dirty indicator when Personal / Skills / Experience / Education / Easy Apply have unsaved edits
- **Save profile** disabled until dirty; on success also `CLOUD_PUSH`

### Tabs

| Tab | Component | Own storage? |
|-----|-----------|----------------|
| Personal | `PersonalTab` | Profile |
| Skills | `SkillsTab` | Profile |
| Resumes | `ResumesTab` | `applykit_resumes` + IndexedDB |
| Experience | `ExperienceTab` | Profile |
| Education | `EducationTab` | Profile |
| Easy Apply | `EasyApplyTab` | Profile |
| Answers | `AnswersTab` | Profile `answerBank` (saves immediately) |
| Mail queue | `QueueTab` | `applykit_queue` |
| Activity log | `ActivityLogTab` | `applykit_activity_log` |
| Backup | `BackupTab` | Profile + queue files |
| AI settings | `AiSettingsTab` | `applykit_ai_settings` |
| Cloud sync | `CloudSyncTab` | `applykit_cloud_sync` + token |

Queue, resumes, activity, AI, and cloud persist immediately (or via their own Save buttons) and do not require the header Save.

`useProfile` on this page: load local → if cloud-primary, `CLOUD_PULL` and replace.

---

## Side panel (F8)

**Entry:** `src/sidepanel/index.html` → `App.tsx`  
**Opened:** popup “Open side panel” → `chrome.sidePanel.open({ tabId })`.

Chrome associates the panel with a tab. Content messages always go to the **active** tab (`tabs.query({ active: true, currentWindow: true })`), which should be the job page.

### Layout

1. Gradient header + Settings
2. Warning if profile name is empty
3. Identity chip (initials, name, headline/email) when profile is complete
4. Four tabs: **Context | Match | Cover | Email**
5. Sticky **footer** (autofill + queue) if name is present

### Context tab (`ContextTab.tsx`)

- **Scan page** — `GET_JOB_CONTEXT`, save session cache
- **Add selection** — uses the page highlight (or the last saved one); **replaces** the current JD
- Source badge (LinkedIn / Greenhouse / Lever / Generic / Manual)
- Description preview with Show more/less at 400 characters
- Source URL link
- If `isHiringText(description)`: **Extract jobs** (`AI_PARSE_POST` with local fallback), list of company/role/email/apply URLs, **+ Queue** per job, **Queue all**

### Match tab (`MatchTab.tsx`)

See [job-context-and-matching.md](./job-context-and-matching.md) and [ai.md](./ai.md).

### Cover tab (`CoverTab.tsx`)

- Seeds from template `coverLetter`; parent holds `coverDraft` for autofill
- **Generate with AI** overwrites the draft
- Copy / Insert on page / Reset to template
- Spinner + API-key hint on AI errors

### Email tab (`EmailTab.tsx`)

- Editable subject + body
- AI generate replaces both
- Copy includes subject line; Insert sends **body only** to the page

### Footer (`SidePanelFooter.tsx`)

Buttons:

- **Fill Easy Apply** — `AUTOFILL` `mode: 'easy_apply'` (primary styling when context is LinkedIn); AI leftovers on
- **Fill form** — `mode: 'form'` (primary on non-LinkedIn); AI leftovers on
- **Save to queue** — `type: 'job_scan'` with current company/role/JD/URL/resume id

Also:

- **Force fill** checkbox (`forceFill: true` on the request)
- Builds `resumeFile` payload (filename + base64 PDF) from the selected resume
- Passes `coverLetter` from the Cover draft (or template)
- Logs `easy_apply_fill` / `form_fill` / `queued` on success
- **Needs you** list from `unmappedFields` (and from session `applykit_last_autofill` after queue fill): type/select + **Save & fill**
- When `applykit_active_apply` is set: **Mark applied** / **Mark applied & next**

Details: [form-fill.md](./form-fill.md).

`useJobContext(true)` auto-loads cached context then scans the tab on mount.

`useSidePanelMatch` loads resumes once, memoizes skill/resume match and template `generated`.

---

## Popup (F9)

**Entry:** `src/popup/index.html` → `App.tsx`  
Width ~320px. No profile editor.

### Job pages

- **Scan job page** — extract context, toast “Found: {title} at {company}”, open side panel
- **Fill form on page** — generic/ATS autofill with AI leftovers (not Easy Apply mode); logs `form_fill` with empty company/role/url
- **Open side panel**

### LinkedIn feed

- **Save LinkedIn post** — `CAPTURE_LINKEDIN_POST`
- Inline form: email (required), company, role
- **Confirm save to queue** as `linkedin_mail`

### Footer

- **Profile settings** → `chrome.runtime.openOptionsPage()`

Busy state is a string (`scan` | `fill` | `capture` | `save`) so only one action runs at a time.

---

## In-page overlays (not Chrome UI)

### LinkedIn post actions (`content/post-overlay.ts`)

On feed/profile/search-content URLs, a MutationObserver scans new posts. If the post text has an email **or** hiring keywords, an ApplyKit bar is inserted above the social action bar:

- Label: recruiter email or “Hiring post detected”
- **1-Click Save** — AI/local parse → enqueue all jobs (or modal if no email/structure)
- **Edit & Save** — modal: email required, company, role; saves one `linkedin_mail` row

Toast (fixed bottom-right) reports success, duplicates, or errors. Posts marked `data-applykit-processed` so they are not double-decorated.

### Gmail

No visible overlay. On load, the Gmail script tries to apply `PendingCompose` from session storage (see [queue-and-mail.md](./queue-and-mail.md)).

---

## Shared UI kit (`components/ui.tsx`)

- `Field` — label + optional hint
- `TextInput` / `TextArea` / `Select` — Tailwind focus rings
- `Button` — `primary` (indigo gradient), `secondary`, `ghost`
- `SectionCard` — options section wrapper
- `StatusBanner` — error / success / info with emoji

`ConfidenceBar` is side-panel-only: clamped 0–100% bar in indigo/green/amber.

---

## Opening flows

```
Toolbar icon
  ├─ Popup: Scan / Fill / Side panel / LinkedIn save / Options
  └─ (Chrome also: right-click → Options)

Side panel Settings  → Options tab
Options Save         → local profile + optional GitHub push
```

There is **no** `commands` keyboard shortcut in the manifest (that is still a Phase 2 item).
