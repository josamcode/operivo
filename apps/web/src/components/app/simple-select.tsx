import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/i18n';

export interface Option {
  value: string;
  label: string;
}

/**
 * A select with labels resolved from options (Base UI renders the label in the trigger).
 * Option labels are interface text and get translated; names and values without a translation stay as they are.
 */
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
  const items = options.map((o) => ({ ...o, label: t(o.label) }));
  return (
    <Select value={value} onValueChange={(v) => v !== null && onChange(String(v))} items={items} disabled={disabled}>
      <SelectTrigger size={size} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <bdi>{o.label}</bdi>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
