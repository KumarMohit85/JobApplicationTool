import { useEffect, useState } from 'react';
import { ACTIVITY_LABELS, clearActivityLog, listActivityLog } from '@/lib/activity-log';
import { Button, StatusBanner } from '@/components/ui';

export function ActivityLogTab() {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof listActivityLog>>>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setEntries(await listActivityLog());
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Clear all activity log entries?')) return;
    await clearActivityLog();
    await reload();
    setMessage('Activity log cleared.');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Recent applications and actions to help avoid double applying.
      </p>

      {message ? <StatusBanner message={message} tone="success" /> : null}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => void reload()} disabled={loading}>
          Refresh
        </Button>
        <Button variant="ghost" onClick={() => void handleClear()} disabled={loading || entries.length === 0}>
          Clear log
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No activity yet. Autofill or save to queue to start logging.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Resume</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{ACTIVITY_LABELS[entry.action]}</td>
                  <td className="px-3 py-2">{entry.company || '—'}</td>
                  <td className="px-3 py-2">{entry.role || '—'}</td>
                  <td className="px-3 py-2">{entry.resumeName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
