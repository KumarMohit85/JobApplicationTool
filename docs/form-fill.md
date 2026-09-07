# Smart form fill, Answer Bank, and apply session

How ApplyKit **scans** an application form, **fills** what it already knows, **asks Gemini** about leftovers, **learns** answers you type, and **walks the queue** without ever clicking Submit.

This is the user-facing loop. Adapter/engine details (selectors, React-safe setters, Greenhouse/Lever roots) stay in [autofill.md](./autofill.md).

**Safety:** ApplyKit never auto-clicks Submit, Send, Next, or Easy Apply continue. Certify / “I agree” / terms checkboxes are never auto-ticked. EEO fields fill only from saved Easy Apply defaults (default text: `Decline to self-identify`).

---

## What you do

1. Open a form (side panel **Fill form** / **Fill Easy Apply**, popup **Fill form on page**, or queue **Fill & apply**).
2. ApplyKit fills mapped profile fields, then the Answer Bank, then leftover fields via Gemini if AI is on.
3. Anything still empty shows in the side panel as **Needs you**. Type an answer and **Save & fill**, or edit the live control on the page — both are stored.
4. You click Submit on the site. Then **Mark applied** (and optionally **Mark applied & next**) in the side panel if this tab came from the queue.

---

## Fill pipeline (`content/autofill/run.ts`)

Triggered by `AUTOFILL` with `AutofillRequest`:

| Field | Meaning |
|-------|---------|
| `mode` | `easy_apply` (LinkedIn modal) or `form` (GH / Lever / generic) |
| `forceFill?` | Overwrite non-empty controls |
| `coverLetter?` | Cover / additional-info textareas |
| `resumeFile?` | `{ fileName, base64 }` for file inputs |
| `useAi?` | Default **true**. Leftover fields go to Gemini when AI is enabled |

Order of work:

1. Load profile, `buildAutofillValues()`, `answerBank`, `customAnswers` (kept in sync with the bank).
2. Site adapter → `autofillRoot()` — see [autofill.md](./autofill.md).
3. For every visible empty control that did not get a value, collect a `ScannedField` (`question`, `fieldType`, `options?`).
4. If `useAi !== false` and there are unmapped fields, send `AI_ANSWER_FIELDS` to the background.
5. For each Gemini `fill` with a value, `fillFieldByQuestion()` writes the DOM and `upsertAnswer(..., source: 'ai_suggested')`.
6. Persist `{ result, url, at }` to session key `applykit_last_autofill` so the side panel can show **Needs you** even when fill was started from the queue (background), not the footer button.
7. Easy Apply only: attach a MutationObserver so the **next wizard step** is filled automatically. Still no Next/Submit click.

`formatAutofillMessage()` reports filled count, skipped (already had values), AI-filled count, and how many fields still need you.

---

## How a field gets a value (`engine.ts`)

For each visible `input` / `textarea` / `select`:

1. Skip hidden, password, submit, button.
2. If the label looks like certify / attest / I agree / terms / privacy policy → **do not fill**. Empty certify checkboxes are listed under Needs you.
3. Map to a `FieldKey` (autocomplete, then regex on label/name/id/placeholder).
4. Value resolution:
   1. Profile map (`buildAutofillValues`) if the key has a non-empty value
   2. Answer Bank (`lookupAnswerValue` — fuzzy question match + variants)
   3. Legacy `customAnswers` substring / token overlap
5. Fill select / radio / text / file as in [autofill.md](./autofill.md).
6. If still empty and the question is at least 6 characters, push onto `unmappedFields` (deduped by normalized question). Radios are de-duped by `name`.

`FILL_FIELD` (side panel **Save & fill**) calls `fillFieldByQuestion()` with `forceFill` so the live control updates immediately.

---

## Answer Bank

Stored on the profile as `answerBank: AnswerEntry[]` (`src/types/answers.ts`).

| Field | Role |
|-------|------|
| `canonicalQuestion` | Display + match key |
| `variants[]` | Other wordings that mean the same thing |
| `answer` | Value reused on future forms |
| `answerType` | `text` / `yes_no` / `number` / `select` / `date` |
| `options?` | Dropdown choices seen on a site |
| `source` | `settings` / `learned` / `ai_suggested` / `user_confirmed` |
| `timesUsed`, `lastUsedAt`, `siteHint` | Usage metadata |

**Matching** (`lib/answers.ts` `questionsMatch`):

- Normalize (strip `*?!.`, lowercase).
- Exact or long substring.
- Else token overlap (stop-words dropped): at least `min(3, shorter token count)` shared tokens of length > 2.

**Upsert:** a new wording of an existing question becomes a variant; the answer is overwritten with what you just used.

**Migration:** `normalizeProfile()` merges `easyApplyDefaults.customAnswers` into the bank and writes the bank back to `customAnswers` so old fill paths keep working. Cloud backup therefore includes both.

### Options → Answers tab

`components/options/AnswersTab.tsx` — search, edit question/answer (saved on blur), delete. Each save `CLOUD_PUSH`es the profile. This tab does **not** use the header dirty/Save flow.

### Form learner

`initFormLearner()` on every page (`content/index.ts`):

- `change` + `blur`, 700ms debounce per question
- Skip identity fields already mapped (`firstName`, `lastName`, `fullName`, `email`, `phone`), passwords, files, questions shorter than 8 characters, certify-style labels
- `SAVE_CUSTOM_ANSWER` → background `upsertAnswer` (`source: 'learned'`) → `saveProfile` → `CLOUD_PUSH`

Edits you make on the live form after autofill are how the bank grows without opening Settings.

### Needs you → Save & fill

Side panel footer lists `unmappedFields`. You type (or pick a `<select>` option) and **Save & fill**:

- `FILL_FIELD` on the active tab
- `SAVE_CUSTOM_ANSWER` with `source: 'user_confirmed'`

You can still change the same control on the page afterward; the learner will update the bank again.

---

## Extra application defaults (Easy Apply tab)

Besides work auth / sponsorship / relocate / years / notice / salary, Settings now stores:

| Default | Typical form wording |
|---------|----------------------|
| Work / citizenship country | country, citizenship, nationality |
| Earliest start date | start date, available to start (notice period is **not** mapped to start date) |
| Work arrangement | remote / hybrid / on-site |
| How did you hear about us | how did you hear / find |
| Know anyone at the company | referral / know anyone |
| Visa type | visa type / immigration status |
| Current company / title | or latest `experience[]` row if blank |
| EEO gender / race / veteran / disability | default **Decline to self-identify** |

These are `FieldKey`s in `lib/autofill-values.ts` + regexes in `lib/autofill-map.ts`. Empty strings are not written onto the page.

---

## AI field intelligence (`lib/ai/fill-fields.ts`)

Background message `AI_ANSWER_FIELDS` with `ScannedField[]`.

If AI is off or the key is missing, every leftover field is `action: 'ask'` (shown in Needs you; nothing is invented).

Otherwise Gemini gets a compact profile (identity, Easy Apply defaults including EEO, skills, summary) plus up to 80 saved answers and the unfilled questions (with dropdown options). JSON:

```json
{
  "decisions": [
    {
      "question": "exact field question string",
      "action": "fill" | "ask" | "skip",
      "value": "string if fill",
      "reason": "short",
      "confidence": 0
    }
  ]
}
```

Rules enforced in the prompt **and** in `parseDecisions()`:

- `fill` only when the value is supported by the profile or bank; dropdown values must be listed options
- `ask` for certify/attest, salary with no saved salary, and any guess
- `skip` when it cannot answer honestly (field dropped from Needs you)
- Certify regex always coerced to `ask`
- Sensitive EEO wording may fill only via the saved EEO defaults already in the profile map (those fields are usually mapped before AI runs)

Suggested fills are stored as `ai_suggested` and reused next time via the bank. You can edit them in Answers or on the page.

The API key never leaves the service worker. Job-page scripts only send field labels/options.

---

## Queue Fill & apply (apply session)

`lib/queue-apply.ts`

**Fill #n / Fill & apply** on a queue row (Options Mail queue):

1. `chrome.tabs.create` with that apply URL (user gesture).
2. `chrome.sidePanel.open({ tabId })` on the same click.
3. Session `applykit_active_apply` = `{ queueItemId, tabId }`.
4. `FILL_TAB_WHEN_READY`: wait until the tab is `complete` (25s timeout), inject the content script if needed, send `AUTOFILL` `mode: 'form'` `useAi: true`.

The row stays **pending**. Applied is only set when you confirm in the side panel (or change status manually).

Side panel, when a session is active:

- **Mark applied** — `status: 'applied'`, activity `job_applied`, clear session. You still Submit on the site yourself.
- **Mark applied & next** — same, then `findNextPendingLinkApply()` (next pending row **after** this one in queue order, no wrap-around) and `startQueuedFormApply` again.

`findNextPendingLinkApply` walks the full queue list so marking the current row applied does not jump back to an earlier pending job.

Multiple apply URLs on one post still get **Fill #1**, **Fill #2**, … each opening that specific URL.

Queue fill does **not** attach a resume PDF (no selected-resume context in the background). Use the side panel **Fill form** on the same tab if you need the file input attempt.

---

## Easy Apply step watch

`content/autofill/easy-apply-watch.ts`

After a successful Easy Apply fill, a `MutationObserver` on the Easy Apply modal debounces 600ms and re-runs fill with `skipWatch: true` (no nested observers). Filling disconnects the observer, then re-attaches after the refill so the following step is watched too.

The observer never clicks Next. If fill itself mutates the modal, the debounce + `filling` lock reduce loops.

---

## Messages and storage (this feature)

| `type` | Direction | Role |
|--------|-----------|------|
| `AUTOFILL` | UI → content | Full scan + fill + optional AI |
| `FILL_FIELD` | UI → content | One question → one control |
| `SAVE_CUSTOM_ANSWER` | content/UI → background | Upsert bank + cloud push |
| `AI_ANSWER_FIELDS` | content → background | Gemini decisions |
| `FILL_TAB_WHEN_READY` | options → background | Wait for tab, then `AUTOFILL` |
| `CLOUD_PUSH` | after AI/learned save | Backup bank with profile |

Session keys: `applykit_last_autofill`, `applykit_active_apply`.

---

## What this does not do

- Auto-Submit / auto-Next / auto-Send
- Auto-check legal attestations
- Ashby / Workday / Indeed-specific adapters (generic fill still runs)
- Attach resume on queue-started fill
- Mail composer fill (unchanged; see [queue-and-mail.md](./queue-and-mail.md))
