import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
};

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

type TextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'number';
  disabled?: boolean;
};

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: TextInputProps) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition-all duration-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

type TextAreaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
};

export function TextArea({ value, onChange, placeholder, rows = 4, disabled }: TextAreaProps) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-sm text-slate-900 shadow-xs outline-none transition-all duration-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
};

export function Select({ value, onChange, options, disabled }: SelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition-all duration-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
}: ButtonProps) {
  const styles = {
    primary:
      'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white shadow-md shadow-indigo-200/50 hover:shadow-indigo-300/60 hover:opacity-95 active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none',
    secondary:
      'border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:bg-slate-50 disabled:text-slate-400',
    ghost:
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] disabled:text-slate-400',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 transition-all">
      <h2 className="mb-5 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function StatusBanner({
  message,
  tone,
}: {
  message: string;
  tone: 'error' | 'success' | 'info';
}) {
  const tones = {
    error: 'border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 text-rose-900',
    success: 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-900',
    info: 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 text-indigo-900',
  };

  const icons = {
    error: '🚨',
    success: '✅',
    info: '💡',
  };

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-xs ${tones[tone]}`}
    >
      <span>{icons[tone]}</span>
      <span className="flex-1">{message}</span>
    </div>
  );
}
