import { useEffect, useRef, useState } from 'react';
import type { QueueItem } from '@/types/queue';
import { csvToQueueItems, downloadCsv, queueToCsv } from '@/lib/csv';
import { appendActivityLog } from '@/lib/activity-log';
import { prepareMailSend } from '@/lib/mail-send';
import { deleteQueueItem, importQueueItems, listQueue, updateQueueItem } from '@/lib/queue';
import { Button, StatusBanner } from '@/components/ui';

export function QueueTab() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    const next = await listQueue();
    setItems(next);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const exportCsv = (pendingOnly: boolean) => {
    const rows = pendingOnly ? items.filter((item) => item.status === 'pending') : items;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`applykit-queue-${pendingOnly ? 'pending-' : ''}${date}.csv`, queueToCsv(rows));
    setMessage({ text: `Exported ${rows.length} row(s).`, tone: 'success' });
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = csvToQueueItems(text);
      const result = await importQueueItems(parsed);
      await reload();
      setMessage({
        text: `Import complete: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`,
        tone: 'success',
      });
    } catch {
      setMessage({ text: 'Import failed. Check CSV format.', tone: 'error' });
    }
  };

  const sendMail = async (item: QueueItem) => {
    setSendingId(item.id);
    setMessage(null);
    const result = await prepareMailSend(item);
    setSendingId(null);
    setMessage({ text: result.message, tone: result.success ? 'success' : 'error' });
    if (result.success) {
      void appendActivityLog({
        action: 'email_sent',
        company: item.company,
        role: item.role,
        url: item.sourceUrl,
        resumeId: item.resumeId,
      });
    }
  };

  const markSent = async (id: string) => {
    const item = items.find((i) => i.id === id);
    await updateQueueItem(id, { status: 'sent' });
    await reload();
    if (item) {
      void appendActivityLog({
        action: 'email_sent',
        company: item.company,
        role: item.role,
        url: item.sourceUrl,
        resumeId: item.resumeId,
      });
    }
  };

  const remove = async (id: string) => {
    await deleteQueueItem(id);
    await reload();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Mail queue and saved job scans. Export to CSV for editing in Excel or Google Sheets, then
        re-import.
      </p>

      {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => exportCsv(false)} disabled={loading || items.length === 0}>
          Export all CSV
        </Button>
        <Button variant="secondary" onClick={() => exportCsv(true)} disabled={loading}>
          Export pending only
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import CSV
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = '';
        }}
      />

      {loading ? (
        <p className="text-sm text-slate-500">Loading queue…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Queue is empty. Save a LinkedIn post or job scan first.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Email / Apply</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{item.type === 'linkedin_mail' ? '📧 Mail' : '🔗 Apply'}</td>
                  <td className="px-3 py-2 font-medium">{item.company || '—'}</td>
                  <td className="px-3 py-2">{item.role || '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">
                    {item.email ? (
                      <a href={`mailto:${item.email}`} className="text-indigo-600 hover:underline">{item.email}</a>
                    ) : item.applyUrls && item.applyUrls.length > 0 ? (
                      <div className="space-y-0.5">
                        {item.applyUrls.map((url, uIdx) => (
                          <a key={uIdx} href={url} target="_blank" rel="noreferrer" className="block truncate text-indigo-600 hover:underline">
                            🔗 {url.slice(0, 35)}…
                          </a>
                        ))}
                      </div>
                    ) : item.applyUrl ? (
                      <a href={item.applyUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{item.applyUrl.slice(0, 35)}…</a>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      item.status === 'sent' ? 'bg-green-100 text-green-700' :
                      item.status === 'applied' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{item.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {item.type === 'linkedin_mail' && item.email && item.status === 'pending' ? (
                        <button
                          type="button"
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                          disabled={sendingId === item.id}
                          onClick={() => void sendMail(item)}
                        >
                          {sendingId === item.id ? 'Opening…' : '📧 Send email'}
                        </button>
                      ) : null}
                      {item.applyUrls && item.applyUrls.length > 0 && item.status === 'pending' ? (
                        item.applyUrls.map((url, uIdx) => (
                          <a
                            key={uIdx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            onClick={() => void markSent(item.id)}
                          >
                            🔗 Apply {item.applyUrls!.length > 1 ? `#${uIdx + 1}` : ''}
                          </a>
                        ))
                      ) : item.applyUrl && item.status === 'pending' ? (
                        <a
                          href={item.applyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          onClick={() => void markSent(item.id)}
                        >
                          🔗 Apply
                        </a>
                      ) : null}
                      {item.status === 'pending' ? (
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:underline"
                          onClick={() => void markSent(item.id)}
                        >
                          Mark done
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => void remove(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
