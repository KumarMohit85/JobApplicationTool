# Job context, matching, and generated copy

How ApplyKit reads a job page, scores skills and resumes, builds cover/email text, and pastes it back into the page.

---

## Job / page context extraction (F4)

### Model

`JobContext` (`src/types/job.ts`):

- `title`, `company`, `description`, `url`
- `source`: `linkedin` | `greenhouse` | `lever` | `generic` | `manual`
- `extractedAt`

`createJobContext()` returns `null` if title, company, **and** description are all empty.

Last successful scan is cached in **`chrome.storage.session`** (`applykit_last_job_context`) so the side panel can show the previous job immediately, then refresh from the live tab.

### Routing (`content/extract.ts`)

Hostname decides the adapter:

1. `linkedin.com` → LinkedIn adapter
2. `greenhouse.io` → Greenhouse
3. `lever.co` → Lever
4. else → generic

### LinkedIn (`content/adapters/linkedin.ts`)

**Official job pages** (`/jobs/view`, `/jobs/collections`, `/jobs/search`):

- Title: `.job-details-jobs-unified-top-card__job-title`, `.jobs-unified-top-card__job-title`, `h1.t-24`, etc.
- Company: company-name classes or `a[href*="/company/"]`
- Description: `#job-details`, `.jobs-description__content`, or a heading match (`description|about the job|…`)

**Feed / post pages** (everything else on LinkedIn):

1. If the user has ≥20 characters selected, that selection becomes the description (`title: "Selected Job Post"`).
2. Else find the post in view via `findPostRoot()` (active element’s activity card, or the post nearest the top of the viewport).
3. Prefer structured capture (`role`, `company`, post permalink) plus the description node (`.feed-shared-update-v2__description`, etc.).

### Greenhouse (`content/adapters/greenhouse.ts`)

Title/company/description CSS list, then heading search, then `largestTextBlock(body, 120)`.

### Lever (`content/adapters/lever.ts`)

Similar. Company may come from `.main-header-logo img[alt]`.

### Generic (`content/adapters/generic.ts`)

- Parse `document.title` with `parseTitleTag()`: `"Role at Company | Site"` or `"Role - Company - Site"`
- Prefer `h1` if short (<120 chars)
- `og:site_name` / `application-name` as company fallback
- Description: heading keywords, else largest text block in `main` (min 200 chars)

`largestTextBlock()` skips `nav`, `header`, `footer`, `aside`, comments, and root wrappers (`#app`, `#root`, `#__next`) so it does not swallow the whole page.

### Selection that survives the side panel

The content script records the highlight on `selectionchange`, `mouseup`, `pointerup`, and `keyup`. It reads `window.getSelection()`, text selected inside an `<input>`/`<textarea>`, and same-origin iframes. Any highlight of 3+ characters is stored in memory **and** `chrome.storage.session` (`applykit_page_selection`).

**Add selection** (`GET_SELECTED_TEXT` + session fallback):

1. Live highlight on the job tab
2. Else in-memory `lastSelectedText` (side panel click usually clears the live selection)
3. Else session copy if it was captured on the same hostname

It does **not** substitute the entire LinkedIn post — that was returning the wrong text when the highlight had already been cleared.

Each **Add selection** **replaces** the current description with the new highlight (it does not append). Title/company from a previous **Scan** are kept when present. The used highlight is then cleared so the next click needs a fresh selection.

---

## Skill matching (F5)

`matchSkills(skills, jobDescription)` in `lib/matcher.ts`.

1. Strip HTML tags, collapse whitespace (`normalizeJobText`).
2. For each skill, test whether the JD **includes** (case-insensitive substring) the skill name or any keyword.
3. Hits go to `matched` with `weight = SKILL_LEVEL_WEIGHT[level]`; misses go to `missing` as names.
4. Matched list sorted by weight desc, then name.
5. **Score** = round(100 × sum(matched weights) / sum(all skill weights)).

This is overlap, not TF-IDF. Short tokens like `go` can false-positive; users should add distinctive keywords (`golang`).

Used by: Options test box, side panel Match tab, template generator (top matched names), mail send, AI request `matchedSkillNames`.

---

## Resume matching (F6)

`scoreResume(resume, jd, role)`:

```
skillHits(resume.skills in jd)           * 3
+ keywordHits(resume.keywords in jd)     * 2
+ roleSimilarity(targetRoles, job title) * 2
+ min(descriptionTokenHits in jd, 5)     * 1
+ resume.priority * 0.1
```

**Role similarity:** 2 if either string contains the other; 1 if any token overlaps; else 0.

`matchResume()` returns the top-scoring variant plus **confidence** = `round(100 * best.score / maxScore)` among all variants (so the winner is often 100% if it is strictly best). `rankResumes()` uses the same formula for the Options test UI.

Side panel (`useSidePanelMatch`):

- Recomputes when JD or resume list changes
- Auto-selects the winner in the dropdown
- User can override; override is in-memory only (not persisted per company)

---

## Template text generation (F7)

`generateContent()` in `lib/generator.ts`. **No API.** Placeholders are `{{word}}` via a simple `fillTemplate`.

### Inputs

`GenerateInput`: profile, `JobContext`, `matchedSkillNames`, optional `resumeName`, optional `driveUrl`.

Skipped when `canGenerateContent` is false: need description length > 20 **or** a title **or** a company.

### Fit paragraph

- If any skills matched: `"My background in {up to 4 skills} aligns well with the {role} at {company}."`
- Then profile `summary`, or else the first non-empty experience bullet / “Most recently I worked as …”.

### Cover letter

Fixed letter: greeting → interest in role at company → fit paragraph → ask to discuss → `Best regards` + name + phone | LinkedIn. Extra blank lines collapsed.

### Cold email

- Subject: `Application for {role} — {company} — {yourName}`
- Body: similar structure; resume line uses display name; if `driveUrl` is set, appends the public link
- Contact line: phone | LinkedIn

Side panel Cover/Email tabs seed from this output, then allow edit. Cover tab keeps a **draft** in parent state so the footer can autofill the edited letter, not only the raw template.

---

## Copy and insert (F15)

### Copy

`copyToClipboard` → `navigator.clipboard.writeText`.

- Cover tab: copies the cover draft
- Email tab: copies `Subject: …\n\n{body}`

### Insert

UI calls `insertTextToActiveTab` → content `insertTextOnPage(text)`:

1. Focused `textarea` → splice at caret, dispatch `input` + `change`
2. Focused text/search `input` → same
3. Focused `contenteditable` → `document.execCommand('insertText')`, else append `textContent`
4. Else the visible, enabled, non-readonly textarea with the **longest current value**
5. Else error: click a field first

This is how users paste a cover letter into Greenhouse “additional information” without autofill mapping that field.

---

## Side panel Match extras

Besides rule-based score bars (`ConfidenceBar`):

- Resume `<select>` override
- Optional **AI Review** (see [ai.md](./ai.md)): apply/maybe/skip, reasons, risks, recommended resume + one-click switch

If there is no JD yet, Match shows a scan prompt instead of empty bars.
