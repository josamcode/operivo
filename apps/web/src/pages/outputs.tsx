import type { ArtifactType } from '@opervio/contracts';
import { FolderOpen, LayoutGrid, List, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { TopBar } from '@/components/app/app-shell';
import { AutoDir, EmptyState, FileGlyph, fileMeta } from '@/components/app/primitives';
import { useDrawers } from '@/components/app/ui-state';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ago, bytes } from '@/lib/format';
import { useOutputs } from '@/lib/queries';
import { cn } from '@/lib/utils';

const TYPES: { id: string; label: string; types?: ArtifactType[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'xlsx', label: 'Sheets', types: ['xlsx', 'csv'] },
  { id: 'md', label: 'Docs', types: ['md', 'docx', 'pdf', 'txt'] },
  { id: 'pptx', label: 'Decks', types: ['pptx'] },
  { id: 'image', label: 'Images', types: ['image'] },
  { id: 'code', label: 'Code', types: ['code', 'diff', 'json', 'html'] },
];

export function OutputsPage() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const query = useDeferredValue(q.trim());
  const { data = [], isLoading } = useOutputs({ q: query || undefined });
  const { openOutput } = useDrawers();
  const types = TYPES.find((t) => t.id === tab)?.types;
  const items = types ? data.filter((o) => types.includes(o.type)) : data;

  return (
    <>
      <TopBar title="Outputs" />
      <div className="mx-auto w-full max-w-[1320px] space-y-5 px-4 py-8 lg:px-8">
        <header className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">Outputs</h1>
            <p className="text-[13.5px] text-ink-2">Every file your team has produced, newest first.</p>
          </div>
          <label className="ms-auto flex h-8 w-64 items-center gap-2 rounded-lg border border-input bg-surface px-2.5 text-[13px] shadow-xs">
            <Search className="size-3.5 text-ink-3" />
            <input dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a file" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
        </header>

        <div className="flex items-center gap-1 border-b border-border">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn('-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors', tab === t.id ? 'border-foreground font-medium text-foreground' : 'border-transparent text-ink-3 hover:text-ink-2')}
            >
              {t.label}
            </button>
          ))}
          <ToggleGroup value={[layout]} onValueChange={(v) => v[0] && setLayout(v[0] as 'grid' | 'list')} className="ms-auto mb-1" size="sm">
            <ToggleGroupItem value="grid" aria-label="Grid">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {!isLoading && items.length === 0 ? (
          <EmptyState icon={FolderOpen} title={query ? 'No files match' : 'No files yet'} hint="Spreadsheets, scripts, decks and documents your agents produce appear here — and on the page they belong to." />
        ) : layout === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((o) => (
              <button key={o.id} type="button" onClick={() => openOutput(o.id)} className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-start shadow-sm transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md">
                <div className="flex items-start gap-3">
                  <FileGlyph type={o.type} size={40} />
                  <div className="min-w-0 flex-1">
                    <AutoDir as="p" text={o.title} className="line-clamp-2 text-[14px] leading-snug font-medium" />
                    <p className="mt-0.5 truncate text-[12px] text-ink-3">{o.fileName}</p>
                  </div>
                </div>
                {o.summary && <AutoDir as="p" text={o.summary} className="line-clamp-2 text-[12.5px] text-ink-2" />}
                <div className="mt-auto flex items-end justify-between gap-3 text-[11.5px] whitespace-nowrap text-ink-3">
                  <span className="truncate">
                    {[fileMeta(o.type).label, bytes(o.sizeBytes), o.agent?.name].filter(Boolean).join(' · ')}
                    {o.focus && <span className="block truncate">{o.focus.name}</span>}
                  </span>
                  <span className="shrink-0">{ago(o.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {items.map((o) => (
              <button key={o.id} type="button" onClick={() => openOutput(o.id)} className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-start last:border-0 hover:bg-muted/50">
                <FileGlyph type={o.type} size={30} />
                <div className="min-w-0 flex-1">
                  <AutoDir as="p" text={o.title} className="truncate text-[13.5px] font-medium" />
                  <p className="truncate text-[11.5px] text-ink-3">{o.fileName}</p>
                </div>
                <span className="hidden w-32 truncate text-[12px] text-ink-2 md:block">{o.focus?.name ?? '—'}</span>
                <span className="hidden w-24 truncate text-[12px] text-ink-2 md:block">{o.agent?.name ?? '—'}</span>
                <span className="num w-16 text-end text-[12px] text-ink-3">{bytes(o.sizeBytes)}</span>
                <span className="w-20 text-end text-[12px] text-ink-3">{ago(o.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
