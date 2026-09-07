# Profile, skills, resumes, and defaults

Everything the user stores once and reuses on every application. UI is the Options page (`src/options/App.tsx`); persistence is `lib/profile.ts`, `lib/skills.ts`, `lib/resumes.ts`, and IndexedDB.

---

## Profile storage (F1)

### Model

`Profile` (`src/types/profile.ts`):

- `version: 1`
- `personal`: name, email, phone, location, LinkedIn, GitHub, portfolio, headline
- `summary`: free text used in templates and AI prompts
- `skills[]`, `experience[]`, `education[]`
- `easyApplyDefaults`
- `answerBank[]` — unique application Q&A (see [form-fill.md](./form-fill.md))
- `updatedAt` ISO string

Storage key: **`applykit_profile`** in `chrome.storage.local`.

### How save/load works

1. Options tabs call `setProfile` + `markDirty()`.
2. Header **Save profile** calls `persist()` → `saveProfile()`.
3. `saveProfile()` runs `normalizeProfile()` then `chrome.storage.local.set`.
4. On success, Options also sends `{ type: 'CLOUD_PUSH', profile }` so a configured GitHub backup updates without a second click.

`getProfile()` always returns a full object: missing keys are filled from `createDefaultProfile()`. Invalid JSON on import throws; the stored blob is merged, not replaced blindly.

### Name handling

`mergePersonal()` / Personal tab:

- Editing **full name** splits on whitespace → `firstName` (first token) + `lastName` (rest).
- Editing first or last name rebuilds `fullName`.
- Autofill can fill either a combined “Name” field or separate first/last fields.

### Years of experience

`resolveYearsOfExperience(profile)`:

1. If `easyApplyDefaults.yearsOfExperience` is set, use it.
2. Else take the earliest valid `experience.startDate` and compute years to now (`365.25` day year, one decimal).
3. Else `undefined` (field left empty).

The Easy Apply Options tab shows the computed value as a placeholder/hint when the override is blank.

### Export / import / reset

Implemented on the Backup tab (also documented in [queue-and-mail.md](./queue-and-mail.md)):

- `exportProfileJson` — pretty-printed JSON
- `importProfileJson` — parse + `normalizeProfile` (does not persist until Save)
- `clearProfile` — removes the storage key; UI reloads defaults
- `downloadJson` — `<a download>` in pages; `chrome.downloads` in the service worker (no `document`)

---

## Personal tab

File: `components/options/PersonalTab.tsx`

Fields: full name, headline, email, phone, location, LinkedIn URL, GitHub URL, portfolio URL, professional summary.

The summary is the main prose source for:

- Template fit paragraph (if present; otherwise the first experience bullet)
- AI prompts (`summary.slice(0, 800)`)
- Email composer fallback body

Empty full name disables side-panel footer actions and shows “Complete profile in settings…”.

---

## Skills library (F2)

### Model

Each `Skill`: `id`, `name`, `level` (`beginner` | `intermediate` | `expert`), `keywords[]`.

Weights (`SKILL_LEVEL_WEIGHT`): beginner **1**, intermediate **2**, expert **3**.

`normalizeSkill()`:

- Trims name; drops skills with empty name
- Invalid level → `intermediate`
- Keywords parsed by `parseKeywordList` (split on `, ; | /`, lowercased, deduped)
- The skill **name itself** is always prepended to keywords if missing

### UI (`SkillsTab.tsx`)

- **Add skill** / **Remove**
- **Import from experience technologies**: flattens `experience[].technologies`, skips names already in the library, adds them as intermediate skills
- Per skill: name, proficiency select, keyword aliases (UI hides the auto-included name token)
- **Test skill match**: paste a JD snippet → `matchSkills()` → score %, matched list with levels, “not found in JD”

Matching algorithm is in [job-context-and-matching.md](./job-context-and-matching.md).

---

## Resume library (F3)

### Split storage

| Piece | Where |
|-------|--------|
| Metadata (`ResumeVariant[]`) | `chrome.storage.local` key `applykit_resumes` |
| PDF bytes | IndexedDB `blobs` store, key = `blobKey` (`resume-blob-{id}`) |

A resume can exist **without** a PDF if `driveUrl` is set (public Google Drive / any URL). Save requires at least a PDF **or** a drive URL.

### Model (`src/types/resume.ts`)

- `id`, `name` (required to persist)
- `fileName`, `blobKey`
- `description` — free text the matcher tokenizes
- `skills[]`, `keywords[]`, `targetRoles[]`
- `driveUrl?` — optional public view link
- `priority` — numeric tie-breaker (default `1`; higher wins when scores are equal via `priority * 0.1` added to score)
- `uploadedAt`

`normalizeResume()` drops entries with empty name. List fields are comma-parsed like skills.

### CRUD (`lib/resumes.ts`)

- `listResumes` / `saveResume(resume, pdfFile?)` / `deleteResume(id)`
- PDF must be `application/pdf` or save throws
- `getResumePdfBlob` / `downloadResumePdf` — object URL in UI pages; data-URL + `chrome.downloads` in the worker

### UI (`ResumesTab.tsx`)

- List with edit / download PDF / delete (confirm dialog)
- Badge **GDrive Link** when `driveUrl` is set
- Editor: display name, priority, drive URL, description, skills, keywords, target roles, optional PDF upload
- **Test resume match**: optional role + JD → `rankResumes()` ordered list with confidence % and “(recommended)” on #1

Drive URLs are concatenated into generated cold-email resume lines (`You can also view my resume online at: …`) when matching picks that variant.

---

## Experience tab

File: `components/options/ExperienceTab.tsx`

Each `Experience`: `id`, `company`, `title`, `startDate`, `endDate` (`string | 'present'`), `bullets[]`, `technologies[]`.

- Empty end date is stored as `'present'`
- Dates are free text (hint `YYYY-MM`); they are only parsed as `Date` when computing years of experience
- Technologies are comma-split; used by “Import from experience technologies”
- First experience entry is used by the template generator for a fallback highlight if `summary` is empty (`recentExperienceHighlight`)
- AI prompts include the first **four** roles as `"title at company"`

There is no reorder UI; array order is insertion order. The generator treats `experience[0]` as “most recent” — users should put the latest role first.

---

## Education tab

File: `components/options/EducationTab.tsx`

Each `Education`: `id`, `school`, `degree`, `year`.

Education is stored and synced with the profile but is **not** currently used by the template generator or autofill field map. AI prompts also do not include education. It is available for future fill/LLM use and for backup completeness.

---

## Easy Apply defaults

File: `components/options/EasyApplyTab.tsx`  
Type: `EasyApplyDefaults`

| Field | Default | Used for |
|-------|---------|----------|
| `authorizedToWork` | Yes | Work authorization questions |
| `requiresSponsorship` | No | Visa sponsorship questions |
| `willingToRelocate` | Yes | Relocation questions |
| `yearsOfExperience` | optional override | Numeric experience fields |
| `noticePeriod` | `"Immediate"` | Notice / availability (not generic “start date”) |
| `expectedSalary` | `""` | Salary / compensation fields |
| `workCountry` | `""` | Country / citizenship / nationality |
| `earliestStartDate` | `""` | Start date / available to start |
| `workArrangement` | `""` | remote / hybrid / onsite |
| `howHeard` | `""` | How did you hear about us |
| `knowAnyoneAtCompany` | No | Employee referral |
| `visaType` | `""` | Visa / immigration status |
| `currentCompany` / `currentTitle` | `""` | Else latest experience row |
| `eeoGender` / `eeoRace` / `eeoVeteran` / `eeoDisability` | `Decline to self-identify` | EEO dropdowns only from these defaults |
| `customAnswers` | `{}` | Mirror of Answer Bank keys (legacy fill path) |

The Options **Easy Apply** tab exposes the defaults above. Unique questions live on the **Answers** tab (`answerBank`). `normalizeProfile()` migrates `customAnswers` into the bank and writes the bank back to `customAnswers`.

The form learner and Needs-you **Save & fill** send `{ question, answer }` as `SAVE_CUSTOM_ANSWER` (see [form-fill.md](./form-fill.md)).

Lookup at fill time:

1. Mapped `FieldKey` from the profile value map
2. Answer Bank fuzzy match (`questionsMatch` + variants)
3. Legacy `lookupCustomAnswer`: normalized substring, else token overlap (at least 2 shared tokens of length > 2)

That is how “Years of experience with React” can reuse an answer saved under “React Experience”.

---

## Options chrome around the profile

`options/App.tsx`:

- Sticky header with dirty pill and **Save profile**
- Twelve tabs: Personal, Skills, Resumes, Experience, Education, Easy Apply, **Answers**, Mail queue, Activity log, Backup, AI settings, Cloud sync
- Resumes, queue, activity, AI, cloud, and Answers tabs manage their **own** storage (Answers saves on blur via `saveProfile`); they do not go through header `persist()`
- `useProfile` loads local first, then if `cloudPrimary` is on, sends `CLOUD_PULL` and replaces the in-memory profile

Default Easy Apply values are created in `createDefaultEasyApplyDefaults()` so a brand-new install is fillable without opening that tab.
