import type { DataResult, DataRow, FieldDef, SectionOf } from '@opervio/contracts';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useData } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { AutoDir } from '../app/primitives';
import { SimpleSelect } from '../app/simple-select';
import { useFiltered, usePageCtx } from './context';
import { FieldValue } from './field-value';
import { Frame } from './sections-basic';
import { collectionOf, Empty } from './sections-shared';

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const fieldMap = (data: DataResult | undefined) => new Map((data?.fields ?? []).map((f) => [f.key, f]));
const titleOf = (row: DataRow, data: DataResult | undefined, field?: string) => String(row[field ?? data?.titleField ?? 'title'] ?? row.title ?? row.name ?? '');

function useRecordPatch(collection: string | undefined) {
  const qc = useQueryClient();
  return async (row: DataRow, patch: Record<string, unknown>) => {
    if (row._kind !== 'record') return;
    qc.setQueriesData<DataResult>({ predicate: (q) => q.queryKey[0] === 'data' && (q.queryKey[2] as { collection?: string })?.collection === collection }, (old) =>
      old ? { ...old, rows: old.rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)) } : old,
    );
    try {
      await api.patch(`/api/records/${row.id}`, { patch });
    } catch (err) {
      toast.error((err as Error).message);
      void qc.invalidateQueries({ queryKey: ['data'] });
    }
  };
}

function FilterChips({ fields, rows, collection }: { fields: FieldDef[]; rows: DataRow[]; collection: string }) {
  const { filters, setFilter } = usePageCtx();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {fields.map((f) => {
        const values = [...new Set(rows.flatMap((r) => (Array.isArray(r[f.key]) ? (r[f.key] as unknown[]) : [r[f.key]])).filter((v) => v !== null && v !== undefined && v !== '').map(String))];
        const ordered = f.options ? f.options.filter((o) => values.includes(o)) : values.sort();
        return (
          <SimpleSelect
            key={f.key}
            ariaLabel={f.label}
            value={filters[collection]?.[f.key] ?? '__all'}
            onChange={(v) => setFilter(collection, f.key, v === '__all' ? null : v)}
            options={[{ value: '__all', label: `${f.label}: all` }, ...ordered.map((v) => ({ value: v, label: `${f.label}: ${v}` }))]}
          />
        );
      })}
    </div>
  );
}

export function TableSection({ s }: { s: SectionOf<'table'> }) {
  const { focusId, openRow } = usePageCtx();
  const { data, isLoading } = useData(s.source, focusId);
  const collection = collectionOf(s.source);
  const rows = useFiltered(data?.rows ?? [], collection);
  const fm = fieldMap(data);
  const cols = useMemo(() => {
    const picked = s.columns?.length ? s.columns : (data?.fields ?? []).filter((f) => f.type !== 'longtext').slice(0, 6).map((f) => ({ field: f.key, label: f.label }));
    return picked.map((c) => {
      const field = fm.get(c.field);
      return {
        id: c.field,
        accessorFn: (r: DataRow) => {
          const v = r[c.field];
          return Array.isArray(v) ? v.join(', ') : (v as string | number | null);
        },
        header: c.label ?? field?.label ?? c.field,
        sortFn: field && ['number', 'currency', 'percent'].includes(field.type) ? ('basic' as const) : ('alphanumeric' as const),
        cell: ({ row }: { row: { original: DataRow } }) => <FieldValue field={field} value={row.original[c.field]} />,
      };
    });
  }, [s.columns, data?.fields]);

  const table = useTable({
    features,
    columns: cols as never,
    data: rows,
    globalFilterFn: 'includesString',
    initialState: { pagination: { pageIndex: 0, pageSize: s.pageSize ?? 10 } },
  } as never) as unknown as TableApi;

  const filterFields = (s.filterable ?? []).map((k) => fm.get(k)).filter(Boolean) as FieldDef[];
  return (
    <Frame title={s.title} description={s.description} bare>
      {(s.searchable || filterFields.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-2 pb-3">
          {s.searchable && (
            <label className="flex h-7 items-center gap-1.5 rounded-md border border-input px-2 text-[12.5px]">
              <Search className="size-3.5 text-ink-3" />
              <input dir="auto" placeholder="Search" className="w-36 bg-transparent outline-none" onChange={(e) => table.setGlobalFilter(e.target.value)} />
            </label>
          )}
          {collection && filterFields.length > 0 && <FilterChips fields={filterFields} rows={data?.rows ?? []} collection={collection} />}
        </div>
      )}
      {isLoading ? (
        <div className="px-4 pb-4">
          <Empty text="Loading…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 pb-4">
          <Empty text={data?.missing ?? 'No rows yet — they appear as your team works.'} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted();
                      return (
                        <th key={h.id} className="border-b border-border bg-surface-2 px-4 py-2 text-start text-[12px] font-medium whitespace-nowrap text-ink-3">
                          <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-foreground">
                            {String(h.column.columnDef.header)}
                            {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : null}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id} onClick={() => openRow(r.original, data?.fields ?? [], data?.titleField ?? 'title')} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50">
                    {r.getAllCells().map((c) => (
                      <td key={c.id} className="max-w-[260px] px-4 py-2 align-middle">
                        <div className="flex min-w-0 items-center">{(c.column.columnDef.cell as (ctx: { row: { original: DataRow } }) => React.ReactNode)({ row: r })}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2 text-[12px] text-ink-3">
              <span className="num">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button type="button" className="grid size-6 place-items-center rounded hover:bg-muted disabled:opacity-40" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} aria-label="Previous page">
                <ChevronLeft className="size-3.5" />
              </button>
              <button type="button" className="grid size-6 place-items-center rounded hover:bg-muted disabled:opacity-40" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} aria-label="Next page">
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </Frame>
  );
}

/** The subset of the v9 table API this renderer uses (keeps the generic types out of the JSX). */
interface TableApi {
  getHeaderGroups(): { id: string; headers: { id: string; column: { getIsSorted(): false | 'asc' | 'desc'; getToggleSortingHandler(): (() => void) | undefined; columnDef: { header?: unknown } } }[] }[];
  getRowModel(): { rows: { id: string; original: DataRow; getAllCells(): { id: string; column: { columnDef: { cell?: unknown } } }[] }[] };
  getPageCount(): number;
  getCanPreviousPage(): boolean;
  getCanNextPage(): boolean;
  previousPage(): void;
  nextPage(): void;
  setGlobalFilter(v: string): void;
  getState(): { pagination: { pageIndex: number } };
}

function KanbanCard({ row, data, s, draggable }: { row: DataRow; data: DataResult | undefined; s: SectionOf<'kanban'>; draggable: boolean }) {
  const { openRow } = usePageCtx();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id, data: { row }, disabled: !draggable });
  const fm = fieldMap(data);
  const extra = (s.cardFields ?? (data?.fields ?? []).filter((f) => f.key !== (s.cardTitle ?? data?.titleField) && f.key !== s.groupBy && f.type !== 'longtext').slice(0, 2).map((f) => f.key)).slice(0, 4);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openRow(row, data?.fields ?? [], data?.titleField ?? 'title')}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn('cursor-pointer rounded-lg border border-border bg-surface p-2.5 shadow-xs transition-shadow hover:border-border-strong', isDragging && 'z-10 shadow-lg')}
    >
      <AutoDir as="p" text={titleOf(row, data, s.cardTitle)} className="line-clamp-2 text-[13px] font-medium" />
      {extra.length > 0 && (
        <div className="mt-1.5 space-y-1 text-[12px] text-ink-2">
          {extra.map((k) => (
            <div key={k} className="flex min-w-0 items-center gap-1.5">
              <FieldValue field={fm.get(k)} value={row[k]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ id, label, count, children }: { id: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn('flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-sunken/60 p-2 transition-colors', isOver && 'bg-brand-soft')}>
      <div className="flex items-center gap-2 px-1 pt-0.5 text-[12.5px]">
        <AutoDir text={label} className="truncate font-medium" />
        <span className="num text-ink-3">{count}</span>
      </div>
      <div className="flex max-h-[560px] min-h-12 flex-col gap-2 overflow-y-auto p-0.5">{children}</div>
    </div>
  );
}

export function KanbanSection({ s }: { s: SectionOf<'kanban'> }) {
  const { focusId } = usePageCtx();
  const { data } = useData(s.source, focusId);
  const collection = collectionOf(s.source);
  const rows = useFiltered(data?.rows ?? [], collection);
  const patch = useRecordPatch(collection);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const columns = useMemo(() => {
    const opts = s.columns ?? data?.fields.find((f) => f.key === s.groupBy)?.options;
    const seen = [...new Set(rows.map((r) => String(r[s.groupBy] ?? '—')))];
    return opts ? [...opts, ...seen.filter((v) => !opts.includes(v))] : seen;
  }, [s.columns, s.groupBy, data, rows]);
  const draggable = s.source.kind === 'records';

  const onDragEnd = (e: DragEndEvent) => {
    const row = e.active.data.current?.row as DataRow | undefined;
    const to = e.over?.id ? String(e.over.id) : null;
    if (!row || !to || String(row[s.groupBy]) === to) return;
    void patch(row, { [s.groupBy]: to });
  };

  return (
    <Frame title={s.title} description={s.description}>
      {columns.length === 0 ? (
        <Empty text={data?.missing ?? 'Cards appear here as work comes in.'} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {columns.map((c) => {
              const items = rows.filter((r) => String(r[s.groupBy] ?? '—') === c);
              return (
                <KanbanColumn key={c} id={c} label={c} count={items.length}>
                  {items.map((r) => (
                    <KanbanCard key={r.id} row={r} data={data} s={s} draggable={draggable} />
                  ))}
                  {items.length === 0 && <div className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11.5px] text-ink-4">Empty</div>}
                </KanbanColumn>
              );
            })}
          </div>
        </DndContext>
      )}
    </Frame>
  );
}

export function ListSection({ s }: { s: SectionOf<'list'> }) {
  const { focusId, openRow } = usePageCtx();
  const { data } = useData(s.source, focusId);
  const collection = collectionOf(s.source);
  const rows = useFiltered(data?.rows ?? [], collection).slice(0, s.limit ?? 50);
  const patch = useRecordPatch(collection);
  const fm = fieldMap(data);
  const sub = s.subtitleField ?? data?.fields.find((f) => f.type === 'longtext' || (f.type === 'text' && f.key !== data.titleField))?.key;
  const meta = s.metaField ?? data?.statusField;
  return (
    <Frame title={s.title} description={s.description} bare>
      {rows.length === 0 ? (
        <div className="px-4 pb-4">
          <Empty text={data?.missing ?? 'Nothing here yet.'} />
        </div>
      ) : (
        <ul className="px-2 pb-2">
          {rows.map((r) => {
            const checked = s.checkField ? r[s.checkField] === true || r[s.checkField] === 'true' : false;
            return (
              <li key={r.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                {s.checkField && (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => void patch(r, { [s.checkField!]: e.target.checked })}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                    aria-label="Done"
                  />
                )}
                <button type="button" onClick={() => openRow(r, data?.fields ?? [], data?.titleField ?? 'title')} className="min-w-0 flex-1 text-start">
                  <AutoDir as="p" text={titleOf(r, data, s.titleField)} className={cn('text-[13.5px] leading-snug', checked && 'text-ink-3 line-through decoration-ink-4')} />
                  {sub && r[sub] ? <AutoDir as="p" text={String(r[sub])} className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-3" /> : null}
                </button>
                {meta && r[meta] !== undefined && (
                  <span className="shrink-0">
                    <FieldValue field={fm.get(meta)} value={r[meta]} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}

export function TimelineSection({ s }: { s: SectionOf<'timeline'> }) {
  const { focusId, openRow } = usePageCtx();
  const { data } = useData(s.source, focusId);
  const rows = useFiltered(data?.rows ?? [], collectionOf(s.source));
  const dateField = s.dateField ?? data?.dateField ?? '_updatedAt';
  const items = rows
    .filter((r) => r[dateField])
    .sort((a, b) => String(b[dateField]).localeCompare(String(a[dateField])))
    .slice(0, s.limit ?? 30);
  return (
    <Frame title={s.title} description={s.description}>
      {items.length === 0 ? (
        <Empty text={data?.missing ?? 'Nothing on the timeline yet.'} />
      ) : (
        <ol>
          {items.map((r, i) => (
            <li key={r.id} className="relative flex gap-3 pb-3">
              {i < items.length - 1 && <span className="absolute start-[3.5px] top-3 bottom-0 w-px bg-border" />}
              <span className="relative mt-1.5 size-2 shrink-0 rounded-full border-2 border-brand bg-surface" />
              <button type="button" onClick={() => openRow(r, data?.fields ?? [], data?.titleField ?? 'title')} className="min-w-0 flex-1 text-start">
                <AutoDir as="p" text={titleOf(r, data, s.titleField)} className="text-[13px] leading-snug" />
                <p className="num text-[11.5px] text-ink-3">{new Date(String(r[dateField])).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Frame>
  );
}

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarSection({ s }: { s: SectionOf<'calendar'> }) {
  const { focusId, openRow } = usePageCtx();
  const { data } = useData(s.source, focusId);
  const rows = useFiltered(data?.rows ?? [], collectionOf(s.source));
  const [offset, setOffset] = useState(0);
  const view = s.view ?? 'week';
  const dateField = s.dateField ?? data?.dateField ?? '_updatedAt';
  const byDay = useMemo(() => {
    const m = new Map<string, DataRow[]>();
    for (const r of rows) {
      const d = new Date(String(r[dateField] ?? ''));
      if (Number.isNaN(d.getTime())) continue;
      const k = key(d);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rows, dateField]);

  const today = key(new Date());
  let days: Date[];
  let label: string;
  if (view === 'week') {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + offset * 7);
    days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    label = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } else {
    const first = new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1);
    const start = startOfWeek(first);
    days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const month = view === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1).getMonth() : -1;

  return (
    <Frame title={s.title} description={s.description}>
      <div className="mb-2 flex items-center gap-1 text-[12.5px]">
        <span className="font-medium">{label}</span>
        <button type="button" className="ms-auto grid size-6 place-items-center rounded hover:bg-muted" onClick={() => setOffset(offset - 1)} aria-label="Previous">
          <ChevronLeft className="size-3.5" />
        </button>
        <button type="button" className="rounded px-1.5 py-0.5 text-ink-3 hover:bg-muted" onClick={() => setOffset(0)}>
          Today
        </button>
        <button type="button" className="grid size-6 place-items-center rounded hover:bg-muted" onClick={() => setOffset(offset + 1)} aria-label="Next">
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {days.slice(0, 7).map((d) => (
          <div key={`h${d.getDay()}`} className="bg-surface-2 px-2 py-1 text-[11px] text-ink-3">
            {d.toLocaleDateString(undefined, { weekday: 'short' })}
          </div>
        ))}
        {days.map((d) => {
          const k = key(d);
          const items = byDay.get(k) ?? [];
          return (
            <div key={k} className={cn('min-h-20 bg-surface p-1.5', view === 'month' && 'min-h-16', month >= 0 && d.getMonth() !== month && 'bg-surface-2 text-ink-4')}>
              <p className={cn('num mb-1 text-[11.5px]', k === today ? 'inline-grid size-5 place-items-center rounded-full bg-brand font-medium text-white' : 'text-ink-3')}>{d.getDate()}</p>
              <div className="space-y-0.5">
                {items.slice(0, view === 'week' ? 4 : 2).map((r) => (
                  <button key={r.id} type="button" onClick={() => openRow(r, data?.fields ?? [], data?.titleField ?? 'title')} className="block w-full truncate rounded bg-brand-soft px-1 py-0.5 text-start text-[11px] text-brand-ink" dir="auto">
                    {titleOf(r, data, s.titleField)}
                  </button>
                ))}
                {items.length > (view === 'week' ? 4 : 2) && <p className="text-[10.5px] text-ink-3">+{items.length - (view === 'week' ? 4 : 2)}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

export function FiltersSection({ s }: { s: SectionOf<'filters'> }) {
  const { focusId } = usePageCtx();
  const { data } = useData({ kind: 'records', collection: s.collection }, focusId);
  const fm = fieldMap(data);
  const fields = s.fields.map((k) => fm.get(k)).filter(Boolean) as FieldDef[];
  if (!fields.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {s.title && <AutoDir text={s.title} className="me-1 text-[12.5px] text-ink-3" />}
      <FilterChips fields={fields} rows={data?.rows ?? []} collection={s.collection} />
    </div>
  );
}
