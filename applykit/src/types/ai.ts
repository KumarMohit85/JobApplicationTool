import type { JobContext } from '@/types/job';
import type { Profile } from '@/types/profile';

export type AiDecision = 'apply' | 'maybe' | 'skip';

export type AiJobReview = {
  decision: AiDecision;
  confidence: number;
  reasons: string[];
  risks: string[];
  recommendedResumeId?: string;
  recommendedResumeReason?: string;
};

export type AiGeneratedContent = {
  fitParagraph: string;
  coverLetter: string;
  coldEmail: { subject: string; body: string };
};

export type AiResumeSummary = {
  id: string;
  name: string;
  description: string;
  skills: string[];
  targetRoles: string[];
  driveUrl?: string;
};

export type AiGenerateRequest = {
  profile: Profile;
  job: JobContext;
  matchedSkillNames: string[];
  resumes: AiResumeSummary[];
  selectedResumeId?: string;
  mode: 'content' | 'review';
  customEmailPrompt?: string;
};

export type AiGenerateResponse = {
  ok: boolean;
  content?: AiGeneratedContent;
  review?: AiJobReview;
  error?: string;
};
