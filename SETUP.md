# ApplyKit — Setup on a new device

This guide covers cloning the repo, building the extension, and loading it in Chrome.

---

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|--------|
| **Node.js** | 18+ (20 LTS recommended) | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Google Chrome** | Latest | For loading unpacked extensions |
| **Git** | Any recent | `git --version` |

---

## 1. Clone the repository

Replace `OWNER` and `REPO` with the GitHub username and repository name shown on the repo page.

### HTTPS (simplest)

Works for everyone; GitHub may prompt for login on private repos:

```bash
git clone https://github.com/OWNER/REPO.git
cd REPO
```

Example for this project:

```bash
git clone https://github.com/KumarMohit85/JobApplicationTool.git
cd JobApplicationTool
```

### SSH

Use this if you already use SSH keys with GitHub (`git@github.com`):

```bash
git clone git@github.com:OWNER/REPO.git
cd REPO
```

Example:

```bash
git clone git@github.com:KumarMohit85/JobApplicationTool.git
cd JobApplicationTool
```

If you use a custom SSH host alias in `~/.ssh/config`, use that host instead of `github.com` in the clone URL.

---

## 2. Install dependencies

The extension source lives in the `applykit/` folder:

```bash
cd applykit
npm install
```

---

## 3. Build the extension

**Production build** (recommended before loading in Chrome):

```bash
npm run build
```

This creates the loadable extension in **`applykit/dist/`**.

**Development build** (auto-rebuild on file changes):

```bash
npm run dev
```

Keep this terminal running while you edit code. After changes, click **Reload** on the extension in Chrome.

---

## 4. Load in Chrome

1. Open **`chrome://extensions`**
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the **`dist`** folder inside `applykit`:

   ```
   JobApplicationTool/applykit/dist
   ```

5. Pin **ApplyKit** from the extensions menu (puzzle icon) for quick access.

---

## 5. First-time configuration

1. Click the **ApplyKit** icon → **Profile settings**  
   (or right-click the icon → Options)
2. Fill in **Personal**, **Experience**, **Education**, and **Easy Apply defaults**
3. Click **Save profile**

Data is stored locally in the browser (`chrome.storage.local`). Nothing is sent to a server.

---

## 6. Updating after `git pull`

When you pull new changes on another machine:

```bash
cd JobApplicationTool
git pull
cd applykit
npm install          # if package.json changed
npm run build
```

Then in **`chrome://extensions`**, click **Reload** on ApplyKit.

---

## 7. AI settings (Gemini)

ApplyKit can generate personalized cover letters, cold emails, and apply/skip job advice using Google Gemini.

1. Get a **free** API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (sign in with Google)
2. In Chrome, click the ApplyKit icon → **Profile settings**
3. Open the **✨ AI settings** tab
4. Paste your key → choose model (default: `gemini-2.0-flash`) → **Save AI settings**
5. Click **Test connection** — you should see "Connection successful"
6. Back in the side panel, open a job page → Click **✨ Generate with AI** on the Cover or Email tab

**Privacy:** Your key is stored only in `chrome.storage.local`. All API calls go through the background service worker — the key is never exposed to page scripts or committed to git.

---

## 8. Cloud profile sync

Sync your profile across devices via a private GitHub Gist.

### Using GitHub Gist (recommended)

1. Create a Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=gist&description=ApplyKit) — enable **`gist`** scope only
2. Options → **☁️ Cloud sync** tab → provider: **GitHub Gist**
3. Paste your token → **Save settings**
4. Click **⬆ Push to Gist** — the Gist ID is auto-filled after first push (save note of it)
5. On another device: enter the same token + Gist ID → **⬇ Pull from cloud**
6. Optional: enable **Cloud is source of truth** to auto-pull when the extension starts

### Using a read-only URL

1. Host `applykit-profile.json` at any accessible URL (e.g. public Gist raw URL)
2. Options → **☁️ Cloud sync** → provider: **Read-only URL** → paste URL → **Pull from cloud**

---

## Troubleshooting

### `npm run build` fails

- Confirm Node version: `node -v` (use 18+)
- Delete install cache and retry:

  ```bash
  rm -rf node_modules package-lock.json
  npm install
  npm run build
  ```

### Extension does not appear after Load unpacked

- Make sure you selected **`applykit/dist`**, not the repo root or `applykit/` source folder
- Run `npm run build` first — `dist/` is not committed to git

### Changes not showing in Chrome

- Click **Reload** on the extension card in `chrome://extensions`
- If using `npm run dev`, rebuild may take a few seconds — reload again

### SSH clone permission denied

- Test your GitHub SSH setup: `ssh -T git@github.com`
- Ensure your SSH public key is added in **GitHub → Settings → SSH and GPG keys**
- See [GitHub's SSH documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

### AI test connection fails

- Check that your key starts with `AIza` and is copied fully
- Ensure AI is **enabled** (checkbox in ✨ AI settings)
- Free tier limit: ~15 requests/min — wait a moment if rate-limited
- Reload the extension (`chrome://extensions` → Reload) and try again

### Cloud push/pull fails

- **401**: GitHub token is invalid or expired — create a new one
- **404 Gist not found**: clear the Gist ID field and push again to create a new one
- Make sure your token has **`gist`** scope and the extension was reloaded after saving

---

## Project structure

```
JobApplicationTool/
├── SETUP.md              ← this file
├── README.md
└── applykit/             ← Chrome extension source
    ├── src/
    │   ├── background/   ← service worker (AI + cloud message router)
    │   ├── lib/
    │   │   ├── ai/       ← Gemini client, prompts, response parser
    │   │   └── cloud-sync.ts  ← GitHub Gist + URL sync
    │   ├── hooks/        ← useProfile, useAiSettings, useCloudSync, useAiGenerate
    │   └── components/
    │       └── options/  ← AiSettingsTab, CloudSyncTab + profile tabs
    ├── dist/             ← load this in Chrome (after build)
    ├── package.json
    └── README.md         ← feature plan & architecture
```

---

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Watch mode — rebuild on save |
| `npm run build` | Production build → `dist/` |
| `npm run compile` | TypeScript check only (no emit) |
