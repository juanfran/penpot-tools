export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] tracking-wider text-gray-400 uppercase">{label}</span>
      <div className="inline-flex overflow-hidden rounded border border-gray-200 bg-gray-50">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={
              value === opt
                ? 'bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-800 shadow-sm'
                : 'px-1.5 py-0.5 font-mono text-[10px] text-gray-400 hover:text-gray-600'
            }
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
