function dispatchInputEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.focus();
  input.value = value;
  dispatchInputEvents(input);
}

function fillContentEditable(el: HTMLElement, text: string): boolean {
  el.focus();
  const ok = document.execCommand('selectAll', false) && document.execCommand('insertText', false, text);
  if (ok) {
    dispatchInputEvents(el);
    return true;
  }
  el.textContent = text;
  dispatchInputEvents(el);
  return true;
}

function findComposeRoot(): ParentNode {
  return (
    document.querySelector('[role="dialog"]') ??
    document.querySelector('.AD') ??
    document.querySelector('.nH') ??
    document.body
  );
}

export function fillGmailCompose(compose: {
  to: string;
  subject: string;
  body: string;
}): { success: boolean; error?: string } {
  const root = findComposeRoot();

  const toInput =
    root.querySelector<HTMLInputElement>('input[name="to"]') ??
    root.querySelector<HTMLInputElement>('textarea[name="to"]') ??
    root.querySelector<HTMLInputElement>('input[aria-label*="To"]');

  const subjectInput =
    root.querySelector<HTMLInputElement>('input[name="subjectbox"]') ??
    root.querySelector<HTMLInputElement>('input[name="subject"]') ??
    root.querySelector<HTMLInputElement>('input[aria-label*="Subject"]');

  const bodyEditable =
    root.querySelector<HTMLElement>('div[aria-label="Message Body"]') ??
    root.querySelector<HTMLElement>('div[aria-label*="Message body"]') ??
    root.querySelector<HTMLElement>('div[role="textbox"][g_editable="true"]');

  if (!toInput && !subjectInput && !bodyEditable) {
    return { success: false, error: 'Gmail compose fields not found. Open a compose window first.' };
  }

  if (toInput && compose.to) setInputValue(toInput, compose.to);
  if (subjectInput && compose.subject) setInputValue(subjectInput, compose.subject);
  if (bodyEditable && compose.body) fillContentEditable(bodyEditable, compose.body);

  return { success: true };
}
