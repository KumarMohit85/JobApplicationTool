import { generateContent } from '@/lib/generator';
import { matchResume, matchSkills } from '@/lib/matcher';
import { getProfile } from '@/lib/profile';
import { listResumes } from '@/lib/resumes';
import { createJobContext } from '@/lib/job-context';
import type { QueueItem } from '@/types/queue';
import { PENDING_COMPOSE_STORAGE_KEY, type PendingCompose } from '@/types/mail';

function buildGmailComposeUrl(compose: PendingCompose): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: compose.to,
    su: compose.subject,
    body: compose.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export async function prepareMailSend(
  item: QueueItem,
  overrideBody?: string,
  overrideSubject?: string,
): Promise<{
  success: boolean;
  message: string;
}> {
  if (!item.email?.trim()) {
    return { success: false, message: 'Queue item is missing an email address.' };
  }

  const profile = await getProfile();
  const resumes = await listResumes();
  const job = createJobContext({
    title: item.role,
    company: item.company,
    description: item.description,
    url: item.sourceUrl,
    source: 'manual',
  });

  if (!job) {
    return { success: false, message: 'Queue item has insufficient job details.' };
  }

  const skillMatch = matchSkills(profile.skills, item.description);
  const resumeMatch = item.resumeId
    ? resumes.find((r) => r.id === item.resumeId)
    : matchResume(resumes, item.description, item.role)?.resume;

  const generated = generateContent({
    profile,
    job,
    matchedSkillNames: skillMatch.matched.map((m) => m.skill.name),
    resumeName: resumeMatch?.name,
    driveUrl: resumeMatch?.driveUrl,
  });

  let body = overrideBody || generated.coldEmail.body;
  if (resumeMatch?.driveUrl?.trim() && !body.includes(resumeMatch.driveUrl.trim())) {
    body += `\n\nYou can view my resume online at: ${resumeMatch.driveUrl.trim()}`;
  }

  const compose: PendingCompose = {
    to: item.email.trim(),
    subject: overrideSubject || generated.coldEmail.subject,
    body,
    resumeFileName: resumeMatch?.fileName,
  };

  await chrome.storage.session.set({ [PENDING_COMPOSE_STORAGE_KEY]: compose });

  const gmailUrl = buildGmailComposeUrl(compose);
  await chrome.tabs.create({ url: gmailUrl });

  return {
    success: true,
    message: 'Gmail compose opened.',
  };
}
