import { useEffect, useRef, useState } from 'react';
import type { QueueItem, QueueStatus } from '@/types/queue';
import type { Profile } from '@/types/profile';
import { csvToQueueItems, downloadCsv, queueToCsv } from '@/lib/csv';
import { appendActivityLog } from '@/lib/activity-log';
import { deleteQueueItem, deleteQueueItems, importQueueItems, listQueue, updateQueueItem } from '@/lib/queue';
import { getProfile } from '@/lib/profile';
import { startQueuedFormApply } from '@/lib/queue-apply';
import { Button, StatusBanner } from '@/components/ui';
import { EmailComposerModal } from './EmailComposerModal';
import { allContactNumbers, hasWhatsAppContact, sendCvViaWhatsApp } from '@/lib/whatsapp-compose';

type FilterType = 'all' | 'email' | 'link' | 'whatsapp';

export function QueueTab() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [composerItem, setComposerItem] = useState<QueueItem | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    const [nextQueue, nextProfile] = await Promise.all([listQueue(), getProfile()]);
    setItems(nextQueue);
    setProfile(nextProfile);
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
        text: `Import complete: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped. (Synced to cloud)`,
        tone: 'success',
      });
    } catch {
      setMessage({ text: 'Import failed. Check CSV format.', tone: 'error' });
    }
  };

  const handleStatusChange = async (id: string, newStatus: QueueStatus) => {
    const item = items.find((i) => i.id === id);
    await updateQueueItem(id, { status: newStatus });
    await reload();
    if (item && (newStatus === 'sent' || newStatus === 'applied')) {
      void appendActivityLog({
        action: newStatus === 'sent' ? 'email_sent' : 'job_applied',
        company: item.company,
        role: item.role,
        url: item.sourceUrl,
        resumeId: item.resumeId,
      });
    }
    setMessage({ text: `Updated status for ${item?.company ?? 'item'} to "${newStatus}" (synced to cloud).`, tone: 'success' });
  };

  const remove = async (id: string) => {
    await deleteQueueItem(id);
    setSelectedIds((prev) => prev.filter((selected) => selected !== id));
    await reload();
    setMessage({ text: 'Item removed from queue (synced to cloud).', tone: 'info' });
  };

  const removeSelected = async () => {
    if (selectedIds.length === 0) return;
    const count = await deleteQueueItems(selectedIds);
    setSelectedIds([]);
    await reload();
    setMessage({
      text: `Removed ${count} job${count === 1 ? '' : 's'} from the queue (synced to cloud).`,
      tone: 'info',
    });
  };

  const handleFillApply = async (item: QueueItem, url?: string) => {
    const result = await startQueuedFormApply(item, url);
    if (result.ok) {
      setMessage({
        text: `Opened apply page for ${item.company}. Fill runs automatically — review, edit any field, then Submit. Use Mark applied in the side panel when done.`,
        tone: 'success',
      });
    } else {
      setMessage({ text: result.error ?? 'Could not open apply page.', tone: 'error' });
    }
  };

  // Separate jobs into Email Apps vs Direct Link Apps vs WhatsApp
  const emailItems = items.filter((i) => Boolean(i.email || i.type === 'linkedin_mail'));
  const linkItems = items.filter((i) => !i.email && Boolean(i.applyUrl || (i.applyUrls && i.applyUrls.length > 0)));
  const whatsappItems = items.filter((i) => hasWhatsAppContact(i));

  const filteredItems =
    activeFilter === 'email'
      ? emailItems
      : activeFilter === 'link'
        ? linkItems
        : activeFilter === 'whatsapp'
          ? whatsappItems
          : items;

  const filteredIdSet = new Set(filteredItems.map((item) => item.id));
  const selectedInView = selectedIds.filter((id) => filteredIdSet.has(id));
  const allFilteredSelected =
    filteredItems.length > 0 && selectedInView.length === filteredItems.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...filteredItems.map((item) => item.id)])]);
  };

  return (
    <div className="space-y-4">
      {/* Overview & Cloud Sync status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            📋 Application Queue ({items.length} total)
          </p>
          <p className="text-xs text-slate-500">
            📧 Email Apps: {emailItems.length} | 🔗 Link Apps: {linkItems.length} | 💬 WhatsApp: {whatsappItems.length}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
          ☁️ Auto-syncing to GitHub repo on every change
        </span>
      </div>

      {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

      {selectedInView.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
          <p className="text-sm font-medium text-indigo-900">
            {selectedInView.length} selected
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)))}
            >
              Clear
            </Button>
            <button
              type="button"
              onClick={() => void removeSelected()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Delete selected
            </button>
          </div>
        </div>
      ) : null}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Jobs ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('email')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === 'email'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📧 Send CV / Email Apps ({emailItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('link')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === 'link'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🔗 Direct Link Apps ({linkItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('whatsapp')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === 'whatsapp'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            💬 WhatsApp ({whatsappItems.length})
          </button>
        </div>

        {/* CSV Actions */}
        <div className="flex gap-2">
          <Button onClick={() => exportCsv(false)} disabled={loading || items.length === 0}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </Button>
        </div>
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
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No jobs in this category. Extract jobs from LinkedIn or scan page first.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all jobs in this view"
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Company</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Contact / Apply Links</th>
                <th className="px-3 py-2.5">Status (Click to update)</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isEmailApp = Boolean(item.email || item.type === 'linkedin_mail');
                return (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        aria-label={`Select ${item.company} ${item.role}`}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      {isEmailApp ? (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                          📧 Send CV
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          🔗 Direct Link
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{item.company || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700">{item.role || '—'}</td>
                    <td className="max-w-[240px] px-3 py-2.5">
                      {item.email ? (
                        <a href={`mailto:${item.email}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          📧 {item.email}
                        </a>
                      ) : null}

                      {item.applyUrls && item.applyUrls.length > 0 ? (
                        <div className="space-y-1">
                          {item.applyUrls.map((url, uIdx) => (
                            <a
                              key={uIdx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-xs text-indigo-600 hover:underline"
                            >
                              🔗 Link #{uIdx + 1}: {url}
                            </a>
                          ))}
                        </div>
                      ) : item.applyUrl ? (
                        <a
                          href={item.applyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-indigo-600 hover:underline"
                        >
                          🔗 {item.applyUrl}
                        </a>
                      ) : !item.email ? (
                        <span className="text-xs text-slate-400">No contact</span>
                      ) : null}
                    </td>

                    {/* Interactive Status Selector */}
                    <td className="px-3 py-2.5">
                      <select
                        value={item.status}
                        onChange={(e) => void handleStatusChange(item.id, e.target.value as QueueStatus)}
                        className={`rounded px-2 py-1 text-xs font-semibold outline-none border transition-colors ${
                          item.status === 'sent'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : item.status === 'applied'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="sent">📧 Sent Email</option>
                        <option value="applied">✅ Applied</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isEmailApp && profile ? (
                          <button
                            type="button"
                            onClick={() => setComposerItem(item)}
                            className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 shadow-sm"
                          >
                            📧 Compose & Send
                          </button>
                        ) : null}

                        {hasWhatsAppContact(item)
                          ? allContactNumbers(item).map((num, nIdx) => (
                              <button
                                key={`wa-${item.id}-${nIdx}`}
                                type="button"
                                onClick={() => void sendCvViaWhatsApp(item, num)}
                                className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 shadow-sm"
                                title={`Send CV via WhatsApp to ${num}`}
                              >
                                💬 {allContactNumbers(item).length > 1 ? `WA #${nIdx + 1}` : 'Send CV on WA'}
                              </button>
                            ))
                          : null}

                        {(item.applyUrls && item.applyUrls.length > 0
                          ? item.applyUrls
                          : item.applyUrl
                            ? [item.applyUrl]
                            : []
                        ).map((url, uIdx, urls) => (
                          <button
                            key={`${item.id}-${uIdx}`}
                            type="button"
                            onClick={() => void handleFillApply(item, url)}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm"
                          >
                            Fill {urls.length > 1 ? `#${uIdx + 1}` : '& apply'}
                          </button>
                        ))}

                        <button
                          type="button"
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                          onClick={() => void remove(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Email Composition Modal */}
      {composerItem && profile ? (
        <EmailComposerModal
          item={composerItem}
          profile={profile}
          onClose={() => setComposerItem(null)}
          onSent={async (updatedItem) => {
            await updateQueueItem(updatedItem.id, {
              email: updatedItem.email,
              resumeId: updatedItem.resumeId,
              status: 'sent',
            });
            await reload();
            setMessage({
              text: `✅ Email sent for ${updatedItem.company}! Updated status to "sent" (synced to cloud).`,
              tone: 'success',
            });
          }}
        />
      ) : null}
    </div>
  );
}
