# AI integration (Gemini)

Optional Google Gemini features. Rule-based matching, templates, and local autofill always work without a key. Leftover form questions can use Gemini when enabled ([form-fill.md](./form-fill.md)).

---

## Settings

Storage key **`applykit_ai_settings`** (`src/types/ai-settings.ts`).

```ts
{
  enabled: boolean;       // default false
  apiKey: string;         // never in git
  model: string;          // default 'gemini-3.7-flash'
  customEmailPrompt?: string;  // injected into content-mode prompts
}
```

Options **AI settings** tab (`AiSettingsTab.tsx`):

- Enable checkbox
- API key field with Show/Hide
- Model `<select>` with fallback labels (3.7 Flash, 3.6 Flash, 3.5 Flash Lite)
- **Load available models from API** → `GET /v1beta/models?key=` filtered to `generateContent`; if the saved model is not in the list, auto-select the first
- Custom cold-email system prompt textarea (default text asks for 120–180 word emails, highlight matching skills, ask for an intro call)
- **Save AI settings** / **Test connection**
- Privacy note: summary, skills, JD go to Google; PDFs do not

Test connection (`AI_TEST`) runs a tiny `mode: 'review'` call with a dummy profile/job.

Link: [Google AI Studio](https://aistudio.google.com/apikey). Host permission: `https://generativelanguage.googleapis.com/*`.

---

## Why the background worker

All Gemini HTTP happens in `src/background/index.ts` + `lib/ai/gemini.ts`. Content scripts and job pages never receive the API key.

UI sends:

```ts
chrome.runtime.sendMessage({ type: 'AI_GENERATE', request: AiGenerateRequest })
```

`handleAiGenerate` loads settings and, if the request omitted it, attaches `customEmailPrompt` from storage.

---

## Client (`lib/ai/gemini.ts`)

Endpoint:

`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=`

Body:

- `contents[0].parts[0].text` = prompt
- `generationConfig.responseMimeType: 'application/json'`
- `temperature: 0.7` (generation) — post-parse uses `0.1` in the background handler

**Model aliases:** old IDs (`gemini-2.0-flash`, `gemini-1.5-pro`, …) map to `gemini-3.7-flash` (or lite for flash-lite). Unknown IDs are passed through.

Errors mapped to user strings: missing key, disabled, network, 429 rate limit, 400/403 invalid key/model, empty candidate text.

---

## Prompts (`lib/ai/prompts.ts`)

Shared **base** block:

- Job title, company, URL, description truncated to **6000** chars
- Candidate name, headline, email, summary (800 chars), keyword-matched skills, up to 4 experience titles
- Resume variants: id, name, target roles, first 12 skills, description 400 chars
- Optional `User-selected resume id`

### `mode: 'review'`

JSON only:

```json
{
  "decision": "apply" | "maybe" | "skip",
  "confidence": 0-100,
  "reasons": ["…"],
  "risks": ["…"],
  "recommendedResumeId": "id or empty",
  "recommendedResumeReason": "one sentence"
}
```

Rules in the prompt: apply = strong fit, maybe = partial, skip = poor fit / red flags; be specific to this JD.

### `mode: 'content'`

JSON: `fitParagraph`, `coverLetter`, `coldEmail: { subject, body }`.

If `customEmailPrompt` is set, it is inserted as **USER CUSTOM SYSTEM PROMPT**. Rules: real name in sign-off, do not invent skills, mention selected resume.

---

## Response parse (`lib/ai/parse.ts`)

Gemini sometimes wraps JSON in ` ```json ` fences despite `responseMimeType`. `stripFences` removes them. Invalid JSON → error with a 120-char preview.

Review: unknown decision → `maybe`; missing confidence → 50. Content: missing strings → `''`.

---

## UI: generate with AI

Hook `useAiGenerate` (`hooks/useAiGenerate.ts`):

- Cache key: `job.url|title` + `profile.updatedAt` + `selectedResumeId` + `mode`
- In-memory `Map` for the side-panel session (avoids re-calling when switching tabs)
- Sets loading/error/result

**Cover tab** and **Email tab** send `mode: 'content'` and write the result into the draft fields.

**Email composer** (queue) does the same without the hook (direct `sendMessage`).

Template text remains the fallback when AI is off, the key is missing, or the call fails.

---

## UI: AI job review

Match tab **Get AI suggestion** / **Re-analyze** → `mode: 'review'`.

Renders:

- Badge: Strong match / Partial / Poor fit
- Confidence %
- Why apply (reasons)
- Risks / gaps
- Recommended resume sentence + **Switch to recommended** if the id differs from the dropdown

Errors that mention API key / Options get a dedicated “add your key” message.

---

## AI hiring-post parser

Not the same as `AI_GENERATE`. Background `handleAiParsePost(rawText, sourceUrl)`:

- If AI disabled or no key → `parseHiringPost()` (`source: 'local'`)
- Else a dedicated extract prompt: JSON **array** of `{ company, role, email, applyUrls, description, requirements }`; ignore WhatsApp/Telegram/YouTube/prep-kit links; `requirements` is technical requirements + expectations only; `temperature: 0.1`
- Parse whole text or a `[...]` substring
- Map into `ParsedJobEntry`; default company/role if missing
- On HTTP/JSON failure → local parser

Used by:

- LinkedIn overlay **1-Click Save**
- Side panel Context **Extract jobs**

---

## AI leftover form fields

Not `AI_GENERATE`. After local autofill, the content script sends leftover `ScannedField[]` as `AI_ANSWER_FIELDS`. Background `callGeminiFillFields()` (`lib/ai/fill-fields.ts`) returns `fill` | `ask` | `skip` per question.

Documented in [form-fill.md](./form-fill.md). Disabled AI → every leftover is `ask` (Needs you). Certify/attest never `fill`. Suggested values are saved on the Answer Bank as `ai_suggested`.

The fill prompt includes a compact profile (Easy Apply defaults, EEO defaults, skills, summary) and up to 80 saved answers. Cover/email `AI_GENERATE` prompts still do **not** interpolate the full Answer Bank.

---

## What is never sent

- Resume PDF bytes
- GitHub token
- Full `customAnswers` / `answerBank` in **cover/email** prompts (those prompts only interpolate personal, summary, matched skills, and a few experience titles). Field-fill prompts **do** include saved answers and Easy Apply defaults so leftover questions can be answered.

---

## Rate limits and models

Free-tier RPM is on Google’s side (docs mention ~15 RPM historically). The client treats HTTP 429 as “wait and retry”.

Model IDs change; the live ListModels fetch is the intended source of truth. Aliases exist so saved `gemini-2.0-flash` keys keep working after Google’s 2026 3.x rename in this codebase.
