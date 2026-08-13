import type { ManifestV3Export } from '@crxjs/vite-plugin';

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'ApplyKit',
  description:
    'Apply to jobs, send tailored emails, and autofill applications with minimal clicks.',
  version: '0.1.0',
  permissions: ['storage', 'activeTab', 'sidePanel', 'scripting', 'downloads', 'tabs'],
  host_permissions: [
    'https://www.linkedin.com/*',
    'https://boards.greenhouse.io/*',
    'https://job-boards.greenhouse.io/*',
    'https://jobs.lever.co/*',
    'https://mail.google.com/*',
  ],
  action: {
    default_title: 'ApplyKit',
    default_popup: 'src/popup/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
    {
      matches: ['https://mail.google.com/*'],
      js: ['src/content/gmail-index.ts'],
      run_at: 'document_idle',
    },
  ],
};

export default manifest;
