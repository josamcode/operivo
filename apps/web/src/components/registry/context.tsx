import type { DataRow, FieldDef } from '@opervio/contracts';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDrawers } from '../app/ui-state';

type Filters = Record<string, Record<string, string>>; // collection → field → value

interface PageCtx {
  focusId: string | null;
  filters: Filters;
  setFilter: (collection: string, field: string, value: string | null) => void;
  openRow: (row: DataRow, fields: FieldDef[], titleField: string) => void;
  record: { row: DataRow; fields: FieldDef[]; titleField: string } | null;
  closeRecord: () => void;
}

const Ctx = createContext<PageCtx | null>(null);

export function PageProvider({ focusId, children }: { focusId: string | null; children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({});
  const [record, setRecord] = useState<PageCtx['record']>(null);
  const { openAgent, openOutput, openDecision } = useDrawers();

  const setFilter = useCallback((collection: string, field: string, value: string | null) => {
    setFilters((f) => {
      const next = { ...(f[collection] ?? {}) };
      if (value === null) delete next[field];
      else next[field] = value;
      return { ...f, [collection]: next };
    });
  }, []);

  /** Every row knows what it is: records open a detail drawer; tasks, agents, outputs open their own. */
  const openRow = useCallback(
    (row: DataRow, fields: FieldDef[], titleField: string) => {
      switch (row._kind) {
        case 'record':
          setRecord({ row, fields, titleField });
          break;
        case 'output':
          openOutput(row.id);
          break;
        case 'agent':
          openAgent(row.id);
          break;
        case 'task':
        case 'activity':
          if (typeof row.agentId === 'string') openAgent(row.agentId);
          break;
        case 'decision':
          openDecision(row.id);
          break;
      }
    },
    [openAgent, openOutput, openDecision],
  );

  const value = useMemo(() => ({ focusId, filters, setFilter, openRow, record, closeRecord: () => setRecord(null) }), [focusId, filters, setFilter, openRow, record]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePageCtx outside PageProvider');
  return v;
}

/** Applies page-level filter chips to rows of a collection. */
export function useFiltered(rows: DataRow[], collection: string | undefined) {
  const { filters } = usePageCtx();
  const active = collection ? filters[collection] : undefined;
  return useMemo(() => {
    if (!active || !Object.keys(active).length) return rows;
    return rows.filter((r) =>
      Object.entries(active).every(([field, value]) => {
        const v = r[field];
        return Array.isArray(v) ? v.map(String).includes(value) : String(v ?? '') === value;
      }),
    );
  }, [rows, active]);
}
