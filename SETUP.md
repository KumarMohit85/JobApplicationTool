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

### SSH (recommended for KumarMohit85 account)

If your `~/.ssh/config` includes:

```
Host github.com-kumar
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

Clone with:

```bash
git clone git@github.com-kumar:KumarMohit85/JobApplicationTool.git
cd JobApplicationTool
```

### HTTPS

```bash
git clone https://github.com/KumarMohit85/JobApplicationTool.git
cd JobApplicationTool
```

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

- Test SSH: `ssh -T git@github.com-kumar`
- Ensure your public key is added to the [KumarMohit85](https://github.com/KumarMohit85) GitHub account

---

## Project structure

```
JobApplicationTool/
├── SETUP.md              ← this file
├── README.md
└── applykit/             ← Chrome extension source
    ├── src/
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
| `npm run compile` | TypeScript check only |
