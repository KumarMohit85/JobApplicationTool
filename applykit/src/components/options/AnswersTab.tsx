import { useEffect, useMemo, useState } from 'react';
import type { AnswerEntry } from '@/types/answers';
import { deleteAnswer, updateAnswer } from '@/lib/answers';
import { getProfile, saveProfile } from '@/lib/profile';
import { Button, StatusBanner, TextInput } from '@/components/ui';

export function AnswersTab() {
  const [entries, setEntries] = useState<AnswerEntry[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const profile = await getProfile();
    setEntries(profile.answerBank ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.canonicalQuestion.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q) ||
        e.variants.some((v) => v.toLowerCase().includes(q)),
    );
  }, [entries, query]);

  const persist = async (next: AnswerEntry[]) => {
    const profile = await getProfile();
    await saveProfile({ ...profile, answerBank: next });
    setEntries(next);
    void chrome.runtime.sendMessage({ type: 'CLOUD_PUSH', profile: { ...profile, answerBank: next } });
  };

  const handleDelete = async (id: string) => {
    await persist(deleteAnswer(entries, id));
    setMessage('Answer removed.');
  };

  const handleAnswerChange = (id: string, answer: string) => {
    setEntries((prev) => updateAnswer(prev, id, { answer }));
  };

  const handleQuestionChange = (id: string, canonicalQuestion: string) => {
    setEntries((prev) => updateAnswer(prev, id, { canonicalQuestion }));
  };

  const persistEntry = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    await persist(updateAnswer(entries, id, {
      canonicalQuestion: entry.canonicalQuestion,
      answer: entry.answer,
    }));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Unique questions learned from past applications (and AI fills). Edit a value here and the next
        form that asks the same thing will use it. You can still change any field on the live form before
        Submit.
      </p>

      {message ? <StatusBanner message={message} tone="success" /> : null}

      <TextInput value={query} onChange={setQuery} placeholder="Search questions or answers…" />

      {loading ? (
        <p className="text-sm text-slate-500">Loading answers…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">
          No learned answers yet. Fill a form (or type on the page) and answers will show up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((entry) => (
            <li key={entry.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {entry.source} · used {entry.timesUsed}×
                  {entry.siteHint ? ` · ${entry.siteHint}` : ''}
                </p>
                <Button variant="ghost" onClick={() => void handleDelete(entry.id)}>
                  Delete
                </Button>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Question</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={entry.canonicalQuestion}
                  onChange={(e) => handleQuestionChange(entry.id, e.target.value)}
                  onBlur={() => void persistEntry(entry.id)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">Answer for future forms</span>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm"
                  value={entry.answer}
                  onChange={(e) => handleAnswerChange(entry.id, e.target.value)}
                  onBlur={() => void persistEntry(entry.id)}
                />
              </label>
              {entry.variants.length > 0 ? (
                <p className="text-xs text-slate-500">Also matches: {entry.variants.join(' · ')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
