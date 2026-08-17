export type QueueItemType = 'linkedin_mail' | 'job_scan';

export type QueueStatus = 'pending' | 'sent' | 'applied';

export type QueueItem = {
  id: string;
  type: QueueItemType;
  status: QueueStatus;
  email?: string;
  applyUrl?: string;
  applyUrls?: string[];
  company: string;
  role: string;
  description: string;
  sourceUrl: string;
  resumeId?: string;
  createdAt: string;
  updatedAt: string;
};

export const QUEUE_STORAGE_KEY = 'applykit_queue';
