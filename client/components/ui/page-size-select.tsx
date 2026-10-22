"use client";

const DEFAULT_PAGE_SIZES = [5, 10, 20, 50, 100] as const;

export function PageSizeSelect({ value, onChange, label = "Rows per page", disabled = false }: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  const sizes = Array.from(new Set([...DEFAULT_PAGE_SIZES, value])).sort((left, right) => left - right);
  return <label className="flex items-center gap-2 text-sm">{label}
    <select
      className="rounded-md border bg-background p-1.5"
      value={value}
      disabled={disabled}
      onChange={event => onChange(Number(event.target.value))}
    >
      {sizes.map(size => <option key={size} value={size}>{size}</option>)}
    </select>
  </label>;
}
