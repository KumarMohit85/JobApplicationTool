# Autofill

How ApplyKit fills LinkedIn Easy Apply, Greenhouse, Lever, and generic apply forms — without submitting.

The scan → Answer Bank → AI leftovers → Needs you → queue apply session loop is documented in **[form-fill.md](./form-fill.md)**. This page is the engine and adapters.

---

## Trigger paths

| UI | Mode | Adapter |
|----|------|---------|
| Side panel **Fill Easy Apply** | `easy_apply` | LinkedIn modal only |
| Side panel **Fill form** | `form` | Hostname: GH / Lever / generic |
| Popup **Fill form on page** | `form` | Same as above (AI leftovers on by default) |
| Queue **Fill & apply** | `form` | Background `FILL_TAB_WHEN_READY`; no resume PDF |

Request shape (`AutofillRequest`):

- `mode`
- `forceFill?` — overwrite non-empty fields
- `coverLetter?` — mapped to cover / additional-info textareas
- `resumeFile?` — `{ fileName, base64 }` for `input[type=file]`
- `useAi?` — leftover fields sent to Gemini (default true)

Request shape (`AutofillRequest`):

- `mode`
- `forceFill?` — overwrite non-empty fields
- `coverLetter?` — mapped to cover / additional-info textareas
- `resumeFile?` — `{ fileName, base64 }` for `input[type=file]`

The UI builds the PDF payload in `buildResumeFilePayload()` (read blob from IndexedDB, `btoa`). The content script never reads IndexedDB for the file; bytes travel on the message.

`runAutofillOnActiveTab` refuses restricted URLs and surfaces “refresh the page” if the content script is missing (after a failed inject).

---

## Run pipeline (`content/autofill/run.ts`)

1. `getProfile()` from `chrome.storage.local`
2. `buildAutofillValues(profile, { coverLetter })` — see value map below
3. `customAnswers` + `answerBank` from the profile
4. If `mode === 'easy_apply'` → LinkedIn Easy Apply adapter (ignores hostname)
5. Else `detectAutofillSite(hostname)`:
   - `linkedin.com` is **not** a special `form` adapter; LinkedIn with `mode: 'form'` uses **generic** (whole page / first form). Easy Apply must use the dedicated button.
   - `greenhouse.io` → Greenhouse form root
   - `lever.co` → Lever form root
   - else generic
6. Unmapped empty fields collected; optional Gemini pass; persist `applykit_last_autofill` (see [form-fill.md](./form-fill.md))

---

## Value map (`lib/autofill-values.ts`)

| FieldKey | Source |
|----------|--------|
| firstName, lastName, fullName, email, phone, location | `personal` |
| linkedIn, github, portfolio, headline | `personal` |
| website | portfolio **or** github |
| authorizedToWork, requiresSponsorship, willingToRelocate | Easy Apply defaults (Yes/No) |
| yearsOfExperience | `resolveYearsOfExperience()` as string |
| noticePeriod, expectedSalary | defaults |
| workCountry, earliestStartDate, workArrangement, howHeard, knowAnyoneAtCompany, visaType | defaults |
| currentCompany, currentTitle | defaults or latest experience |
| eeoGender, eeoRace, eeoVeteran, eeoDisability | defaults (`Decline to self-identify`) |
| coverLetter | request extra |

Empty strings are still set on the map; the engine skips fill when `value` is falsy.

---

## Field mapping (`field-mapper.ts` + `autofill-map.ts`)

For each visible control, `collectFieldHints` concatenates:

label (`<label for>`, wrapping label, `aria-labelledby`, `aria-label`, placeholder, nearby label/legend/span) + `name` + `id` + placeholder + aria-label + `autocomplete` + `data-test` + `data-qa`

`mapFieldKey`:

1. Match HTML `autocomplete` against known tokens (`given-name`, `email`, `tel`, …). Skip `fullName` if hints already contain `first` or `last` so first/last fields are not both filled with the full name.
2. Else test regex patterns on the hint string (first name, last name, email, phone, LinkedIn, GitHub, portfolio, website, cover letter, work auth, sponsorship, relocate, years, notice, salary, …).

Unmapped fields can still fill via the **Answer Bank** or **custom answers** (`lookupAnswerValue` / `lookupCustomAnswer` on the same hints). Leftovers after that become `unmappedFields` (see [form-fill.md](./form-fill.md)).

---

## Engine (`content/autofill/engine.ts`)

`autofillRoot(root, values, request, customAnswers, answerBank)` walks visible `input`, `textarea`, `select`.

Unmapped questions and Answer Bank lookup: [form-fill.md](./form-fill.md).

**Visibility:** skip `type=hidden`; require non-zero bounding rect.

**Empty vs force:** `shouldFill` is false for disabled/readonly. Without force, skip if `value.trim()` is already set. Radios: skip the group if any is checked unless force.

**Text / email / tel / url / number / search:** React-safe setter — `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` then `input` + `change` events. Focus first.

**Select:** pick option whose text or value equals / contains the profile value; Yes/No prefix match (`Yes, I am authorized…`).

**Radio:** click + `checked = true` on the matching label/value.

**File:** if `resumeFile` present and input empty, decode base64 → `File` → `DataTransfer` → `input.files`. Many ATS (and LinkedIn) block this; then a **hint** is added: `Choose resume file: {fileName}` or `Attached resume: …`.

Return: `{ filledCount, skippedCount, hints[], errors[], unmappedFields[], aiFilledCount? }`.

The UI string (`formatAutofillMessage`) is like “Filled 6 fields. 2 already had values. Attached resume: …”.

**Never clicked:** Next, Review, Submit, Easy Apply primary buttons.

---

## LinkedIn Easy Apply (F10)

Selectors are centralized in `linkedin-selectors.ts` (update here when LinkedIn ships DOM changes):

- `[data-test-modal-id="easy-apply-modal"]`
- `.jobs-easy-apply-modal`
- `[data-test-modal="easy-apply"]`
- fallback `div[role="dialog"]` that contains inputs and is on-screen

If no modal: error *“Open the LinkedIn Easy Apply modal first…”*.

Fill runs on the **current wizard step**, then `watchEasyApplySteps()` re-fills when the modal DOM changes (user clicked Next). There is still no auto-click of Next or Submit. See [form-fill.md](./form-fill.md).

If a file input exists but attach failed, extra hint `Choose resume: {fileName}`.

Activity log action: `easy_apply_fill` (side panel only, when `filledCount > 0`).

---

## Greenhouse (F11)

Form root, first match:

`#application_form`, `#application-form`, `form#application`, `form[action*="greenhouse"]`, else first `form`.

Then `autofillRoot`.

---

## Lever (F11)

`.application-form`, `form.postings-form`, `form[action*="lever"]`, else first `form`.

---

## Generic (F11)

`form[action*="apply"]`, `form#application-form`, first `form`, else `document.body` (so sites with unwrapped inputs still fill).

---

## Form learner (small feature)

`initFormLearner()` runs on **every** page from `content/index.ts`. Full rules: [form-fill.md](./form-fill.md).

Delegated `change` and `blur` (capture phase), 700ms debounce:

- Ignore password/hidden/submit/button/file, names containing `password`/`token`
- Skip mapped identity keys (first/last/full name, email, phone)
- Question text from `extractQuestionLabel` (same label strategy as mapping, strip `*` `#`)
- Skip questions shorter than 8 characters, empty values, or certify/terms labels
- `SAVE_CUSTOM_ANSWER` → background upserts the **Answer Bank** → `saveProfile` → `CLOUD_PUSH`

---

## Site detect (`detect-site.ts`)

```ts
linkedin.com  → 'linkedin'   // only used if you called detect; form mode still generic
greenhouse.io → 'greenhouse'
lever.co      → 'lever'
else          → 'generic'
```

LinkedIn **job description** extraction is separate (adapters under `content/adapters/`). Autofill on a LinkedIn **job page outside the modal** uses generic fill of whatever form is on the page (usually none).

---

## Safety

- Restricted browser URLs: no message sent
- Empty-field default reduces overwriting recruiter-prefilled LinkedIn data
- Force fill is explicit and off by default
- File attach is best-effort; toast/hint tells the user which PDF to pick
- No auto-submit by design
- Certify / I agree / terms checkboxes are never auto-ticked
