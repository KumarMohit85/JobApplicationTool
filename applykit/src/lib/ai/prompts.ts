import type { AiGenerateRequest } from '@/types/ai';

function trimJobDescription(description: string, max = 6000): string {
  const text = description.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function buildAiPrompt(request: AiGenerateRequest): string {
  const { profile, job, matchedSkillNames, resumes, selectedResumeId, mode, customEmailPrompt } = request;

  const resumeLines = resumes.map(
    (r) =>
      `- id: ${r.id} | name: ${r.name} | driveUrl: ${r.driveUrl || 'none'} | roles: ${r.targetRoles.join(', ') || 'n/a'} | skills: ${r.skills.slice(0, 12).join(', ')} | description: ${r.description.slice(0, 400)}`,
  );

  const customInstructions = customEmailPrompt?.trim()
    ? `\nUSER CUSTOM SYSTEM PROMPT & INSTRUCTIONS FOR COLD EMAIL & APPLICATION COPY:\n"${customEmailPrompt.trim()}"\n`
    : '';

  const base = `You are an expert job application assistant. Write professional, concise, honest copy. Never invent employers, degrees, or skills not supported by the profile.

JOB DESCRIPTION & REQUIREMENTS:
- Title: ${job.title || 'Unknown'}
- Company: ${job.company || 'Unknown'}
- URL: ${job.url || 'n/a'}
- Description / Required Skills:
${trimJobDescription(job.description || job.title || 'No description provided.')}

CANDIDATE PROFILE
- Name: ${profile.personal.fullName}
- Headline: ${profile.personal.headline}
- Email: ${profile.personal.email}
- Summary: ${profile.summary.slice(0, 800)}
- Matched skills from keyword scan: ${matchedSkillNames.join(', ') || 'none'}
- Experience (most recent first): ${profile.experience
    .slice(0, 4)
    .map((e) => `${e.title} at ${e.company}`)
    .join('; ') || 'none'}

RESUME VARIANTS
${resumeLines.length > 0 ? resumeLines.join('\n') : '- none uploaded'}
${selectedResumeId ? `User-selected resume id: ${selectedResumeId}` : ''}`;

  if (mode === 'review') {
    return `${base}

TASK: Analyze fit and return JSON only (no markdown):
{
  "decision": "apply" | "maybe" | "skip",
  "confidence": 0-100,
  "reasons": ["string", ...],
  "risks": ["string", ...],
  "recommendedResumeId": "id from list or empty string",
  "recommendedResumeReason": "one sentence"
}

Rules:
- "apply" = strong skill/role fit
- "maybe" = partial fit or missing info
- "skip" = poor fit or major red flags
- Be specific to this job description`;
  }

  return `${base}
${customInstructions}
TASK: Generate tailored application copy. Return JSON only (no markdown):
{
  "fitParagraph": "2-3 sentences on fit",
  "coverLetter": "full cover letter with greeting and sign-off",
  "coldEmail": {
    "subject": "email subject line",
    "body": "email body, include drive link if available, professional tone"
  }
}

Rules:
- Use the candidate's real name in sign-off
- Strictly adhere to the USER CUSTOM SYSTEM PROMPT & INSTRUCTIONS provided above
- Do not claim skills not in profile or matched skills
- If the selected resume (or matching resume) has a driveUrl, automatically include a clear line in the cold email body with the drive link to view the resume online (e.g. "You can view my resume online at: [driveUrl]"). Do not prompt the user to download a local file.`;
}
