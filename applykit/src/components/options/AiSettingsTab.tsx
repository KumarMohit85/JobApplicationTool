import { useState } from 'react';
import { DEFAULT_GEMINI_MODEL } from '@/types/ai-settings';
import { fetchAvailableModels } from '@/lib/ai/gemini';
import { useAiSettings } from '@/hooks/useAiSettings';
import { Button, StatusBanner } from '@/components/ui';

/** Shown before dynamic models load, or if fetch fails. */
const FALLBACK_MODEL_OPTIONS = [
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (recommended)' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (fastest / cheapest)' },
];

export function AiSettingsTab() {
  const { settings, loading, saving, error, setSettings, save } = useAiSettings();
  const [showKey, setShowKey] = useState(false);
  const [modelOptions, setModelOptions] = useState(FALLBACK_MODEL_OPTIONS);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  /** Fetch the live model list from the Gemini API using the current key. */
  const handleFetchModels = async () => {
    const key = settings.apiKey.trim();
    if (!key) return;
    setFetchingModels(true);
    setTestStatus(null);
    try {
      const ids = await fetchAvailableModels(key);
      if (ids.length > 0) {
        const opts = ids.map((id) => ({ value: id, label: id }));
        setModelOptions(opts);
        // Auto-select first if current value isn't in the list
        if (!ids.includes(settings.model)) {
          setSettings({ model: ids[0] });
        }
        setTestStatus({
          message: `Found ${ids.length} available model(s). Dropdown updated.`,
          tone: 'success',
        });
      } else {
        setTestStatus({ message: 'No models returned. Check your API key.', tone: 'error' });
      }
    } catch (err) {
      setTestStatus({
        message: err instanceof Error ? err.message : 'Could not fetch models.',
        tone: 'error',
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSave = async () => {
    setSaveMessage(null);
    setTestStatus(null);
    const ok = await save();
    if (ok) setSaveMessage('AI settings saved.');
  };

  const handleTest = async () => {
    setSaveMessage(null);
    setTestStatus(null);
    setTesting(true);
    await save();
    try {
      const response = (await chrome.runtime.sendMessage({ type: 'AI_TEST' })) as {
        ok: boolean;
        error?: string;
      };
      setTestStatus(
        response.ok
          ? { message: 'Connection successful! Gemini is responding.', tone: 'success' }
          : { message: response.error ?? 'Connection failed.', tone: 'error' },
      );
    } catch {
      setTestStatus({ message: 'Extension error — try reloading.', tone: 'error' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <StatusBanner message="Loading AI settings…" tone="info" />;

  const canTest = settings.apiKey.trim().length > 10;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
        <p className="text-sm font-medium text-indigo-900">✨ AI-powered generation</p>
        <p className="mt-1 text-xs text-indigo-700">
          Add your Gemini API key to get personalized cover letters, cold emails, and smart
          apply/skip advice — beyond what templates can do.
        </p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
        >
          Get a free Gemini key at Google AI Studio →
        </a>
      </div>

      {error ? <StatusBanner message={error} tone="error" /> : null}
      {saveMessage ? <StatusBanner message={saveMessage} tone="success" /> : null}
      {testStatus ? <StatusBanner message={testStatus.message} tone={testStatus.tone} /> : null}

      {/* Enable toggle */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          id="ai-enabled"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          checked={settings.enabled}
          onChange={(e) => setSettings({ enabled: e.target.checked })}
        />
        <span className="text-sm font-medium text-slate-900">Enable AI features</span>
      </label>

      {/* API Key */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700" htmlFor="ai-api-key">
          Gemini API key
        </label>
        <div className="relative">
          <input
            id="ai-api-key"
            type={showKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={(e) => setSettings({ apiKey: e.target.value })}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-24 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Stored only in your browser (chrome.storage.local). Never sent anywhere other than
          Google's Gemini API.
        </p>
      </div>

      {/* Model selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700" htmlFor="ai-model">
            Model
          </label>
          <button
            type="button"
            disabled={!canTest || fetchingModels}
            onClick={() => void handleFetchModels()}
            className="text-xs font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800 disabled:opacity-40"
          >
            {fetchingModels ? 'Loading…' : '↻ Load available models from API'}
          </button>
        </div>
        <select
          id="ai-model"
          value={settings.model || DEFAULT_GEMINI_MODEL}
          onChange={(e) => setSettings({ model: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        >
          {modelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Click "Load available models" to fetch the exact list your API key can access.
          Model names change over time — always use the live list.
        </p>
      </div>

      {/* Privacy note */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Privacy:</strong> When you use AI features, your profile summary, matched skills,
        and job description are sent to Google's Gemini API. Resume PDFs are never sent.
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save AI settings'}
        </Button>
        <Button
          variant="secondary"
          disabled={!canTest || testing || saving}
          onClick={() => void handleTest()}
        >
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
      </div>

      {!settings.enabled && (
        <p className="text-xs text-slate-400">
          AI features are disabled. Enable above to use "Generate with AI" in the side panel.
        </p>
      )}
    </div>
  );
}
