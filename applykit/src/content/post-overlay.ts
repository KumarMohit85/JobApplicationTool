import { addQueueItem } from '@/lib/queue';
import { captureLinkedInPostFromElement, type LinkedInPostCapture } from './post-capture';

const OVERLAY_CLASS = 'applykit-post-save-btn';
const MODAL_CLASS = 'applykit-post-modal';
const PROCESSED_ATTR = 'data-applykit-processed';

const HIRING_HINT = /hiring|opening|position|mail.*resume|send.*resume|apply.*@|email.*resume/i;

function isLinkedInFeedPage(): boolean {
  return /linkedin\.com\/(feed|posts|in\/|search\/results\/content)/i.test(window.location.href);
}

function styleButton(button: HTMLButtonElement): void {
  button.type = 'button';
  button.textContent = 'Save to mail queue';
  button.className = OVERLAY_CLASS;
  Object.assign(button.style, {
    marginTop: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
    background: '#4f46e5',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  });
}

function removeModal(): void {
  document.querySelector(`.${MODAL_CLASS}`)?.remove();
}

function showSaveModal(capture: LinkedInPostCapture, onDone: (message: string, ok: boolean) => void): void {
  removeModal();

  const overlay = document.createElement('div');
  overlay.className = MODAL_CLASS;
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: '999999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    width: 'min(420px, 100%)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    fontFamily: 'system-ui, sans-serif',
  });

  panel.innerHTML = `
    <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Save to mail queue</h2>
    <label style="display:block;margin-bottom:10px;font-size:13px;color:#334155;">
      Email <span style="color:#dc2626">*</span>
      <input data-field="email" type="email" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;" />
    </label>
    <label style="display:block;margin-bottom:10px;font-size:13px;color:#334155;">
      Company
      <input data-field="company" type="text" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;" />
    </label>
    <label style="display:block;margin-bottom:10px;font-size:13px;color:#334155;">
      Role
      <input data-field="role" type="text" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;" />
    </label>
    <p data-status style="min-height:18px;margin:0 0 10px;font-size:12px;color:#64748b;"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button data-action="cancel" type="button" style="padding:8px 14px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;">Cancel</button>
      <button data-action="save" type="button" style="padding:8px 14px;border:none;background:#4f46e5;color:#fff;border-radius:8px;cursor:pointer;font-weight:600;">Save</button>
    </div>
  `;

  const emailInput = panel.querySelector<HTMLInputElement>('[data-field="email"]')!;
  const companyInput = panel.querySelector<HTMLInputElement>('[data-field="company"]')!;
  const roleInput = panel.querySelector<HTMLInputElement>('[data-field="role"]')!;
  const statusEl = panel.querySelector('[data-status]')!;

  emailInput.value = capture.emails[0] ?? '';
  companyInput.value = capture.company;
  roleInput.value = capture.role;

  panel.querySelector('[data-action="cancel"]')?.addEventListener('click', () => removeModal());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) removeModal();
  });

  panel.querySelector('[data-action="save"]')?.addEventListener('click', () => {
    void (async () => {
      const email = emailInput.value.trim();
      if (!email) {
        statusEl.textContent = 'Email is required.';
        return;
      }
      statusEl.textContent = 'Saving…';
      const { item, duplicate } = await addQueueItem({
        type: 'linkedin_mail',
        email,
        company: companyInput.value.trim(),
        role: roleInput.value.trim(),
        description: capture.description,
        sourceUrl: capture.sourceUrl,
      });
      if (duplicate) {
        statusEl.textContent = 'Already in queue.';
        onDone('Already in queue.', false);
      } else if (item) {
        statusEl.textContent = 'Saved!';
        onDone('Saved to mail queue.', true);
        setTimeout(removeModal, 800);
      } else {
        statusEl.textContent = 'Save failed.';
        onDone('Save failed.', false);
      }
    })();
  });

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  emailInput.focus();
}

function attachButtonToPost(post: Element): void {
  if (post.getAttribute(PROCESSED_ATTR)) return;

  const text = post.textContent ?? '';
  const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(text);
  const hasHiringHint = HIRING_HINT.test(text);
  if (!hasEmail && !hasHiringHint) return;

  post.setAttribute(PROCESSED_ATTR, '1');

  const button = document.createElement('button');
  styleButton(button);

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const capture = captureLinkedInPostFromElement(post);
    if (!capture) {
      showSaveModal(
        { emails: [], company: '', role: '', description: text.slice(0, 2000), sourceUrl: window.location.href },
        () => undefined,
      );
      return;
    }
    showSaveModal(capture, () => undefined);
  });

  const actions =
    post.querySelector('.feed-shared-social-action-bar, .social-details-social-activities') ??
    post.querySelector('[class*="social-action"]') ??
    post;

  if (actions instanceof HTMLElement) {
    actions.appendChild(button);
  }
}

function scanPosts(root: ParentNode = document.body): void {
  const posts = root.querySelectorAll('[data-urn*="activity"], .feed-shared-update-v2');
  for (const post of posts) {
    attachButtonToPost(post);
  }
}

export function initLinkedInPostOverlay(): void {
  if (!isLinkedInFeedPage()) return;

  scanPosts();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          scanPosts(node);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
