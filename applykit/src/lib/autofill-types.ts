export type AutofillMode = 'easy_apply' | 'form';

export type ResumeFilePayload = {
  fileName: string;
  base64: string;
};

export type AutofillRequest = {
  mode: AutofillMode;
  forceFill?: boolean;
  coverLetter?: string;
  resumeFile?: ResumeFilePayload;
};

export type AutofillResult = {
  filledCount: number;
  skippedCount: number;
  hints: string[];
  errors: string[];
};
