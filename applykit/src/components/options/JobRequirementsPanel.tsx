import { extractJobRequirements } from '@/lib/post-parser';
import type { QueueItem } from '@/types/queue';

export function displayJobRequirements(item: QueueItem): string {
  const stored = item.requirements?.trim();
  if (stored) return stored;
  return extractJobRequirements(item.description);
}

export function JobRequirementsPanel({ item }: { item: QueueItem }) {
  const text = displayJobRequirements(item);

  if (!text) {
    return (
      <p className="text-xs text-slate-500">
        No technical requirements or expectations were found in this post.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Technical requirements & expectations
      </p>
      <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-slate-700">{text}</pre>
    </div>
  );
}
