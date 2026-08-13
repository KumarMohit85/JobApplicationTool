export const PENDING_COMPOSE_STORAGE_KEY = 'applykit_pending_compose';

export type PendingCompose = {
  to: string;
  subject: string;
  body: string;
  resumeFileName?: string;
};

export type GmailFillResult = {
  success: boolean;
  error?: string;
};

export type GmailFillMessage = {
  type: 'FILL_GMAIL_COMPOSE';
  compose: PendingCompose;
};

export type GmailFillResponse = {
  type: 'GMAIL_FILL_RESULT';
} & GmailFillResult;
