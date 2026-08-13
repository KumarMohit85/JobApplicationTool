export type ActivityAction = 'easy_apply_fill' | 'form_fill' | 'email_sent' | 'queued';

export type ActivityEntry = {
  id: string;
  action: ActivityAction;
  company: string;
  role: string;
  url: string;
  resumeId?: string;
  resumeName?: string;
  timestamp: string;
};

export const ACTIVITY_LOG_STORAGE_KEY = 'applykit_activity_log';
