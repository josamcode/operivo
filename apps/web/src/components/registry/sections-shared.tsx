import type { DataSource, FieldDef } from '@opervio/contracts';
import { t } from '@/lib/i18n';

export const collectionOf = (s: DataSource) => (s.kind === 'records' ? s.collection : undefined);

/** Empty states are interface text: translated; server messages about missing data get a friendly line. */
export function Empty({ text }: { text: string }) {
  const shown = /^No data yet for /.test(text) ? t('No data yet') : t(text);
  return <p className="py-2 text-[12.5px] text-ink-3">{shown}</p>;
}

const LATIN_START = /^[a-z]/;
/** AI-made keys like "niche" or "stage" read as labels: "Niche", "Stage". Arabic labels are left as they are. */
export const humanize = (s: string) => (LATIN_START.test(s) ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);
export const fieldLabel = (f: FieldDef | undefined, key: string) => humanize(f?.label || key);
