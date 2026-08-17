import { useState } from 'react';
import type { JobContext } from '@/types/job';
import { parseHiringPost, isHiringText, type ParsedJobEntry } from '@/lib/post-parser';
import { addQueueItem } from '@/lib/queue';
import { Button, StatusBanner } from '@/components/ui';

const SOURCE_LABELS: Record<JobContext['source'], string> = {
  linkedin: 'LinkedIn',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  generic: 'Generic',
  manual: 'Manual selection',
};

type ContextTabProps = {
  context: JobContext | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  onAppendSelection: () => Promise<boolean>;
};

export function ContextTab({
  context,
  loading,
  error,
  onRefresh,
  onAppendSelection,
}: ContextTabProps) {
  const [expanded, setExpanded] = useState(false);
  const [parsedJobs, setParsedJobs] = useState<ParsedJobEntry[]>([]);
  const [queueStatus, setQueueStatus] = useState<{
    message: string;
    tone: 'success' | 'error' | 'info';
  } | null>(null);
  const [queueing, setQueueing] = useState(false);

  const [parsing, setParsing] = useState(false);

  // Parse jobs using AI / Smart parser
  const handleParseJobs = async () => {
    if (!context?.description) return;
    setParsing(true);
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'AI_PARSE_POST',
        rawText: context.description,
        sourceUrl: context.url,
      })) as { ok: boolean; jobs?: ParsedJobEntry[]; source?: 'ai' | 'local' };

      const entries = res.jobs || parseHiringPost(context.description, context.url);
      setParsedJobs(entries);

      const sourceLabel = res.source === 'ai' ? '✨ AI' : 'Smart Parser';
      if (entries.length === 0) {
        setQueueStatus({
          message: `${sourceLabel}: No actionable jobs found.`,
          tone: 'info',
        });
      } else {
        setQueueStatus({
          message: `${sourceLabel} extracted ${entries.length} job(s)!`,
          tone: 'info',
        });
      }
    } catch {
      const entries = parseHiringPost(context.description, context.url);
      setParsedJobs(entries);
    } finally {
      setParsing(false);
    }
  };

  const handleQueueAll = async () => {
    if (parsedJobs.length === 0) return;
    setQueueing(true);
    setQueueStatus(null);
    let added = 0;
    let dupes = 0;

    for (const job of parsedJobs) {
      const { item, duplicate } = await addQueueItem({
        type: job.email ? 'linkedin_mail' : 'job_scan',
        email: job.email || undefined,
        applyUrl: job.applyUrl || undefined,
        applyUrls: job.applyUrls.length > 0 ? job.applyUrls : undefined,
        company: job.company,
        role: job.role,
        description: job.description,
        sourceUrl: job.sourceUrl || context?.url || '',
      });
      if (duplicate) dupes++;
      else if (item) added++;
    }

    setQueueing(false);
    setQueueStatus({
      message:
        added > 0
          ? `✅ Queued ${added} job(s)!${dupes > 0 ? ` (${dupes} already in queue)` : ''}`
          : `All ${dupes} job(s) already in queue.`,
      tone: added > 0 ? 'success' : 'info',
    });
  };

  const handleQueueSingle = async (job: ParsedJobEntry) => {
    const { item: _item, duplicate } = await addQueueItem({
      type: job.email ? 'linkedin_mail' : 'job_scan',
      email: job.email || undefined,
      applyUrl: job.applyUrl || undefined,
      applyUrls: job.applyUrls.length > 0 ? job.applyUrls : undefined,
      company: job.company,
      role: job.role,
      description: job.description,
      sourceUrl: job.sourceUrl || context?.url || '',
    });
    setQueueStatus({
      message: duplicate
        ? `Already in queue: ${job.company} — ${job.role}`
        : `✅ Queued: ${job.company} — ${job.role}`,
      tone: duplicate ? 'info' : 'success',
    });
  };

  const descriptionPreview =
    context?.description && context.description.length > 400 && !expanded
      ? `${context.description.slice(0, 400)}…`
      : context?.description;

  const isHiring = context?.description ? isHiringText(context.description) : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading} onClick={() => void onRefresh()}>
          {loading ? 'Scanning…' : 'Scan page'}
        </Button>
        <Button variant="secondary" disabled={loading} onClick={() => void onAppendSelection()}>
          Add selection
        </Button>
      </div>

      {error ? <StatusBanner message={error} tone="info" /> : null}
      {queueStatus ? (
        <StatusBanner message={queueStatus.message} tone={queueStatus.tone} />
      ) : null}

      {context ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{context.title || 'Unknown role'}</p>
              <p className="text-slate-600">{context.company || 'Unknown company'}</p>
            </div>
            <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {SOURCE_LABELS[context.source]}
            </span>
          </div>

          {context.description ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Job description
              </p>
              <p className="whitespace-pre-wrap text-slate-700">{descriptionPreview}</p>
              {context.description.length > 400 ? (
                <button
                  type="button"
                  className="mt-1 text-xs text-indigo-600 hover:underline"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-slate-500">No description extracted. Use Add selection on the page.</p>
          )}

          {context.url ? (
            <a
              href={context.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-indigo-600 hover:underline"
            >
              {context.url}
            </a>
          ) : null}

          {/* Smart job extraction + auto-queue */}
          {isHiring && context.description ? (
            <div className="space-y-2 rounded-lg border border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-purple-900">🎯 Hiring post detected</p>
                <button
                  type="button"
                  disabled={parsing}
                  onClick={() => void handleParseJobs()}
                  className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {parsing ? '✨ AI Extracting…' : '✨ Extract jobs'}
                </button>
              </div>

              {parsedJobs.length > 0 ? (
                <div className="space-y-2">
                  {parsedJobs.map((job, i) => (
                    <div
                      key={i}
                      className="space-y-1.5 rounded-md border border-purple-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-xs">
                            {job.company} — {job.role}
                          </p>
                          {job.email ? (
                            <p className="text-xs text-slate-600">📧 {job.email}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleQueueSingle(job)}
                          className="shrink-0 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          + Queue
                        </button>
                      </div>

                      {/* Display corresponding apply links */}
                      {job.applyUrls.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Apply Link(s) ({job.applyUrls.length})
                          </p>
                          {job.applyUrls.map((url, urlIdx) => (
                            <a
                              key={urlIdx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline"
                            >
                              <span>🔗</span>
                              <span className="truncate">{url}</span>
                            </a>
                          ))}
                        </div>
                      ) : !job.email ? (
                        <p className="text-xs text-slate-400">No direct link or contact</p>
                      ) : null}
                    </div>
                  ))}

                  <button
                    type="button"
                    disabled={queueing}
                    onClick={() => void handleQueueAll()}
                    className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {queueing
                      ? 'Queueing…'
                      : `🚀 Queue all ${parsedJobs.length} job(s)`}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : !loading && !error ? (
        <p className="text-sm text-slate-500">Open a job posting, then click Scan page.</p>
      ) : null}
    </div>
  );
}
