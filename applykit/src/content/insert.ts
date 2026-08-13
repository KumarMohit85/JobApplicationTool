/** Insert text into the focused field or the best visible textarea on the page. */

function dispatchInputEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertIntoTextControl(el: HTMLTextAreaElement | HTMLInputElement, text: string): boolean {
  if (el instanceof HTMLInputElement && el.type !== 'text' && el.type !== 'search') {
    return false;
  }

  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  el.value = next;
  const cursor = start + text.length;
  el.selectionStart = cursor;
  el.selectionEnd = cursor;
  el.focus();
  dispatchInputEvents(el);
  return true;
}

function insertIntoContentEditable(el: HTMLElement, text: string): boolean {
  el.focus();
  const ok = document.execCommand('insertText', false, text);
  if (ok) {
    dispatchInputEvents(el);
    return true;
  }
  el.textContent = (el.textContent ?? '') + text;
  dispatchInputEvents(el);
  return true;
}

function findBestTextarea(): HTMLTextAreaElement | null {
  const textareas = [...document.querySelectorAll('textarea')].filter((ta) => {
    const rect = ta.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !ta.disabled && !ta.readOnly;
  });
  if (textareas.length === 0) return null;
  return textareas.reduce((best, ta) =>
    ta.value.length > best.value.length ? ta : best,
  );
}

export function insertTextOnPage(text: string): { success: boolean; error?: string } {
  if (!text.trim()) {
    return { success: false, error: 'No text to insert.' };
  }

  const active = document.activeElement;

  if (active instanceof HTMLTextAreaElement) {
    return { success: insertIntoTextControl(active, text) };
  }

  if (active instanceof HTMLInputElement) {
    if (insertIntoTextControl(active, text)) {
      return { success: true };
    }
  }

  if (active instanceof HTMLElement && active.isContentEditable) {
    return { success: insertIntoContentEditable(active, text) };
  }

  const fallback = findBestTextarea();
  if (fallback) {
    fallback.focus();
    return { success: insertIntoTextControl(fallback, text) };
  }

  return {
    success: false,
    error: 'Click a text field on the page first, or focus a textarea, then try Insert again.',
  };
}
