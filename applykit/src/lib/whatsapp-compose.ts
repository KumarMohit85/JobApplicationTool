/**
 * WhatsApp CV compose — deep-link only, mirrors the Gmail "Open & send" safety model.
 * Never auto-sends. Opens wa.me pre-filled with intro text; user attaches resume and taps Send.
 */

import type { QueueItem } from '@/types/queue';
import { getProfile } from '@/lib/profile';

/**
 * Build a short cover-note suitable for WhatsApp (plain text, ≤ 400 chars).
 */
function buildWhatsAppMessage(item: QueueItem, name: string): string {
  const greeting = `Hi, I am ${name}.`;
  const intent = item.role && item.role !== 'Open Position'
    ? `I'm interested in the ${item.role} position`
    : `I'm interested in opportunities`;
  const company = item.company && item.company !== 'Hiring Company'
    ? ` at ${item.company}`
    : '';
  return `${greeting} ${intent}${company}. Please find my CV attached. Looking forward to hearing from you!`;
}

/**
 * Normalise a raw phone/WhatsApp number string to digits only (international, no +).
 * e.g. "+91 97370 80195" → "919737080195"
 */
export function normaliseToDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Open WhatsApp compose for a single number.
 * Downloads the resume PDF so the user can easily attach it.
 */
export async function openWhatsAppCompose(
  number: string,
  messageOverride?: string,
  item?: QueueItem,
): Promise<void> {
  const digits = normaliseToDigits(number);
  if (!digits || digits.length < 7) return;

  let text = messageOverride ?? '';
  if (!text && item) {
    const profile = await getProfile();
    const name = [profile.personal?.firstName, profile.personal?.lastName].filter(Boolean).join(' ') || 'Applicant';
    text = buildWhatsAppMessage(item, name);
  }

  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  await chrome.tabs.create({ url });
  // Tip: attach your resume PDF in WhatsApp before tapping Send.
}

/**
 * Pick the best number for WhatsApp and open compose.
 * Prefers explicitly identified WhatsApp numbers, falls back to any phone number.
 */
export async function sendCvViaWhatsApp(item: QueueItem, numberOverride?: string): Promise<void> {
  const target =
    numberOverride ??
    item.whatsappNumbers?.[0] ??
    item.phoneNumbers?.[0];

  if (!target) return;
  await openWhatsAppCompose(target, undefined, item);
}

/**
 * Returns true when the item has at least one contactable WhatsApp or phone number.
 */
export function hasWhatsAppContact(item: QueueItem): boolean {
  return Boolean(
    (item.whatsappNumbers && item.whatsappNumbers.length > 0) ||
    (item.phoneNumbers && item.phoneNumbers.length > 0),
  );
}

/**
 * All numbers to show in a dropdown (WhatsApp first, then phone-only).
 */
export function allContactNumbers(item: QueueItem): string[] {
  const wa = item.whatsappNumbers ?? [];
  const ph = (item.phoneNumbers ?? []).filter((n) => !wa.includes(n));
  return [...wa, ...ph];
}
