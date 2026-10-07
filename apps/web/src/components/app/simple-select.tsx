import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface Option {
  value: string;
  label: string;
}

/** A select with labels resolved from options (Base UI renders the label in the trigger). */
export function SimpleSelect({
  value,
  onChange,
  options,
  size = 'sm',
  className,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  size?: 'sm' | 'default';
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => v !== null && onChange(String(v))} items={options} disabled={disabled}>
      <SelectTrigger size={size} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
