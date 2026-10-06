import type { DataSource } from '@opervio/contracts';

export const collectionOf = (s: DataSource) => (s.kind === 'records' ? s.collection : undefined);

export function Empty({ text }: { text: string }) {
  return <p className="py-2 text-[12.5px] text-ink-3">{text}</p>;
}
