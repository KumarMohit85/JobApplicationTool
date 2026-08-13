type ConfidenceBarProps = {
  label: string;
  value: number;
  tone?: 'indigo' | 'green' | 'amber';
};

const TONE_CLASSES: Record<NonNullable<ConfidenceBarProps['tone']>, string> = {
  indigo: 'bg-indigo-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
};

export function ConfidenceBar({ label, value, tone = 'indigo' }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-600">{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${TONE_CLASSES[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
