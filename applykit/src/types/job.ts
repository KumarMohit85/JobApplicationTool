export type JobSource = 'linkedin' | 'greenhouse' | 'lever' | 'generic' | 'manual';

export type JobContext = {
  title: string;
  company: string;
  description: string;
  url: string;
  source: JobSource;
  extractedAt: string;
};

export const JOB_CONTEXT_STORAGE_KEY = 'applykit_last_job_context';
