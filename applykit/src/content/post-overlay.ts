import { addQueueItem } from '@/lib/queue';
import { captureLinkedInPostFromElement, type LinkedInPostCapture } from './post-capture';

const OVERLAY_CONTAINER_CLASS = 'applykit-post-actions-container';
const MODAL_CLASS = 'applykit-post-modal';
const TOAST_CLASS = 'applykit-post-toast';
const PROCESSED_ATTR = 'data-applykit-processed';

const HIRING_HINT =
  /hiring|opening|position|role|mail.*resume|send.*resume|share.*resume|apply.*@|email.*resume|looking for|join our team|opportunity/i;

function isLinkedInFeedPage(): boolean {
  return /linkedin\.com\/(feed|posts|in\/|search\/results\/content|detail)/i.test(window.location.href);
}

function showToast(message: string, isSuccess = true): void {
  document.querySelector(`.${TOAST_CLASS}`)?.remove();

  const toast = document.createElement('div');
  toast.className = TOAST_CLASS;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '9999999',
    padding: '12px 18px',
    background: isSuccess ? '#059669' : '#dc2626',
    color: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease',
  });

  toast.innerHTML = `<span>${isSuccess ? '✅' : '⚠️'}</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function removeModal(): void {
  document.querySelector(`.${MODAL_CLASS}`)?.remove();
}

function showSaveModal(
  capture: LinkedInPostCapture,
  onDone?: (message: string, ok: boolean) => void,
): void {
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
    background: '#ffffff',
    borderRadius: '14px',
    padding: '24px',
    width: 'min(440px, 100%)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">Save to Mail Queue</h2>
      <span style="font-size:11px;background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:12px;font-weight:600;">LinkedIn Hiring Post</span>
    </div>

    <label style="display:block;margin-bottom:12px;font-size:13px;font-weight:500;color:#334155;">
      Recruiter / Contact Email <span style="color:#dc2626">*</span>
      <input data-field="email" type="email" style="display:block;width:100%;margin-top:4px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;" placeholder="recruiter@company.com" />
    </label>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <label style="display:block;font-size:13px;font-weight:500;color:#334155;">
        Company
        <input data-field="company" type="text" style="display:block;width:100%;margin-top:4px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;" />
      </label>
      <label style="display:block;font-size:13px;font-weight:500;color:#334155;">
        Role
        <input data-field="role" type="text" style="display:block;width:100%;margin-top:4px;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;" />
      </label>
    </div>

    <p data-status style="min-height:18px;margin:0 0 14px;font-size:12px;color:#64748b;"></p>

    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button data-action="cancel" type="button" style="padding:9px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:#475569;">Cancel</button>
      <button data-action="save" type="button" style="padding:9px 16px;border:none;background:#4f46e5;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Save to Queue</button>
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
        statusEl.textContent = 'Email address is required.';
        return;
      }
      statusEl.textContent = 'Saving to queue…';
      const { item, duplicate } = await addQueueItem({
        type: 'linkedin_mail',
        email,
        company: companyInput.value.trim() || 'Hiring Company',
        role: roleInput.value.trim() || 'Open Position',
        description: capture.description,
        sourceUrl: capture.sourceUrl,
      });

      if (duplicate) {
        showToast(`Already in mail queue: ${email}`, false);
        onDone?.('Already in queue.', false);
        removeModal();
      } else if (item) {
        showToast(`Saved to mail queue! (${email})`, true);
        onDone?.('Saved to mail queue.', true);
        removeModal();
      } else {
        statusEl.textContent = 'Save failed.';
        onDone?.('Save failed.', false);
      }
    })();
  });

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  emailInput.focus();
}

async function quickSavePost(capture: LinkedInPostCapture): Promise<void> {
  const email = capture.emails[0];
  if (!email) {
    // If no email found automatically, open modal to let user input it
    showSaveModal(capture);
    return;
  }

  const { item, duplicate } = await addQueueItem({
    type: 'linkedin_mail',
    email,
    company: capture.company || 'Hiring Company',
    role: capture.role || 'Open Position',
    description: capture.description,
    sourceUrl: capture.sourceUrl,
  });

  if (duplicate) {
    showToast(`Already in mail queue: ${email}`, false);
  } else if (item) {
    showToast(`Saved to mail queue! (${email})`, true);
  } else {
    showToast('Failed to save to mail queue.', false);
  }
}

function attachButtonToPost(post: Element): void {
  if (post.getAttribute(PROCESSED_ATTR)) return;

  const text = post.textContent ?? '';
  const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(text);
  const hasHiringHint = HIRING_HINT.test(text);
  if (!hasEmail && !hasHiringHint) return;

  post.setAttribute(PROCESSED_ATTR, '1');

  const container = document.createElement('div');
  container.className = OVERLAY_CONTAINER_CLASS;
  Object.assign(container.style, {
    margin: '10px 16px',
    padding: '8px 12px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  });

  const label = document.createElement('div');
  label.style.fontSize = '12px';
  label.style.fontWeight = '600';
  label.style.color = '#334155';
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.gap = '6px';

  const matches = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const emailFound = matches ? matches[0] : null;

  if (emailFound) {
    label.innerHTML = `<span style="color:#4f46e5;">📬 ApplyKit</span> <span style="color:#64748b;font-weight:normal;">Recruiter: ${emailFound}</span>`;
  } else {
    label.innerHTML = `<span style="color:#4f46e5;">📬 ApplyKit</span> <span style="color:#64748b;font-weight:normal;">Hiring post detected</span>`;
  }

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '6px';

  // ⚡ 1-Click Save button
  const quickSaveBtn = document.createElement('button');
  quickSaveBtn.type = 'button';
  quickSaveBtn.innerHTML = '⚡ 1-Click Save';
  Object.assign(quickSaveBtn.style, {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#ffffff',
    background: 'linear-gradient(to right, #4f46e5, #7c3aed)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
  });

  quickSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const capture = captureLinkedInPostFromElement(post);
    if (capture) {
      void quickSavePost(capture);
    } else {
      showToast('Could not extract post details.', false);
    }
  });

  // Edit / Review button
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.innerHTML = '✏ Edit & Save';
  Object.assign(editBtn.style, {
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#475569',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
  });

  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const capture = captureLinkedInPostFromElement(post);
    if (!capture) {
      showSaveModal({
        emails: emailFound ? [emailFound] : [],
        company: '',
        role: '',
        recruiterName: '',
        description: text.slice(0, 2000),
        sourceUrl: window.location.href,
      });
      return;
    }
    showSaveModal(capture);
  });

  btnGroup.appendChild(quickSaveBtn);
  btnGroup.appendChild(editBtn);
  container.appendChild(label);
  container.appendChild(btnGroup);

  // Insert before social action bar or at the bottom of the post
  const actions =
    post.querySelector('.feed-shared-social-action-bar, .social-details-social-activities') ??
    post.querySelector('[class*="social-action"]') ??
    post;

  if (actions instanceof HTMLElement && actions.parentNode) {
    actions.parentNode.insertBefore(container, actions);
  } else {
    post.appendChild(container);
  }
}

function scanPosts(root: ParentNode = document.body): void {
  const POST_SELECTORS = [
    '[data-urn*="activity"]',
    '.feed-shared-update-v2',
    'div[data-id*="urn:li:activity"]',
    '.occluded-update',
    '[data-view-name*="feed-full-update"]',
    '.profile-creator-shared-feed-update__container',
  ].join(', ');

  const posts = root.querySelectorAll(POST_SELECTORS);
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
