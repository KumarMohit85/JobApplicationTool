export type ResumeVariant = {
  id: string;
  name: string;
  fileName: string;
  blobKey: string;
  description: string;
  skills: string[];
  keywords: string[];
  targetRoles: string[];
  priority: number;
  uploadedAt: string;
};

export const RESUMES_STORAGE_KEY = 'applykit_resumes';
