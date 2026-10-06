import { CollectionDef, formatZodError, recordSchema, type RecordData, type Where } from '@opervio/contracts';
import { bus } from '../bus';
import { db, Prisma } from '../db';
import { ValidationError } from './pages';

export async function getCollection(key: string) {
  const row = await db.collection.findUnique({ where: { key } });
  return row ? { row, def: CollectionDef.parse(row.def) } : null;
}

/** Creates or evolves a collection. Existing fields keep working; new fields are added. */
export async function defineCollection(input: unknown, focusId?: string | null) {
  const parsed = CollectionDef.safeParse(input);
  if (!parsed.success) throw new ValidationError(formatZodError(parsed.error, 'collection'));
  const def = parsed.data;
  const existing = await getCollection(def.key);
  if (existing) {
    // Merge: keep old fields the AI didn't mention so existing records stay valid.
    const merged = { ...def, fields: [...def.fields, ...existing.def.fields.filter((f) => !def.fields.some((n) => n.key === f.key))] };
    const check = CollectionDef.safeParse(merged);
    if (!check.success) throw new ValidationError(formatZodError(check.error, 'collection'));
    const row = await db.collection.update({ where: { key: def.key }, data: { def: check.data, focusId: focusId ?? existing.row.focusId } });
    bus.invalidate(`collection:${def.key}`, 'pages');
    return { row, def: check.data, created: false };
  }
  const row = await db.collection.create({ data: { key: def.key, def, focusId: focusId ?? null } });
  bus.invalidate(`collection:${def.key}`, 'pages');
  return { row, def, created: true };
}

export interface UpsertResult {
  created: number;
  updated: number;
  errors: string[];
}

/**
 * Upserts records. A record may carry `key` (stable id such as a domain or URL) for dedupe;
 * existing records are merged (partial validation), new ones fully validated.
 */
export async function upsertRecords(
  collectionKey: string,
  records: { key?: string; data: RecordData }[],
  meta: { agentId?: string | null; focusId?: string | null } = {},
): Promise<UpsertResult> {
  const col = await getCollection(collectionKey);
  if (!col) throw new ValidationError(`No collection "${collectionKey}". Call define_collection first.`);
  const full = recordSchema(col.def);
  const partial = recordSchema(col.def, { partial: true });
  const result: UpsertResult = { created: 0, updated: 0, errors: [] };
  for (const [i, rec] of records.entries()) {
    const key = rec.key?.trim().toLowerCase().slice(0, 200) || null;
    const existing = key
      ? await db.dataRecord.findUnique({ where: { collectionId_externalKey: { collectionId: col.row.id, externalKey: key } } })
      : null;
    const parsed = existing ? partial.safeParse(rec.data) : full.safeParse(rec.data);
    if (!parsed.success) {
      result.errors.push(`record ${i}${key ? ` (${key})` : ''}: ${formatZodError(parsed.error, 'record').replace('Invalid record:\n', '')}`);
      continue;
    }
    const clean = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
    if (existing) {
      await db.dataRecord.update({ where: { id: existing.id }, data: { data: { ...(existing.data as object), ...clean } as Prisma.InputJsonValue } });
      result.updated++;
    } else {
      await db.dataRecord.create({
        data: {
          collectionId: col.row.id,
          externalKey: key,
          data: clean as Prisma.InputJsonValue,
          focusId: meta.focusId ?? col.row.focusId,
          agentId: meta.agentId ?? null,
        },
      });
      result.created++;
    }
  }
  bus.invalidate(`collection:${collectionKey}`, 'home');
  return result;
}

export async function updateRecordFields(id: string, patch: RecordData) {
  const rec = await db.dataRecord.findUnique({ where: { id }, include: { collection: true } });
  if (!rec) throw new ValidationError('Record not found');
  const def = CollectionDef.parse(rec.collection.def);
  const parsed = recordSchema(def, { partial: true }).safeParse(patch);
  if (!parsed.success) throw new ValidationError(formatZodError(parsed.error, 'record'));
  const updated = await db.dataRecord.update({
    where: { id },
    data: { data: { ...(rec.data as object), ...parsed.data } as Prisma.InputJsonValue },
  });
  bus.invalidate(`collection:${rec.collection.key}`, 'home');
  return updated;
}

export function matchesWhere(data: RecordData, where?: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([field, expected]) => {
    const actual = data[field];
    if (Array.isArray(expected)) return expected.map(String).includes(String(actual));
    if (Array.isArray(actual)) return actual.map(String).includes(String(expected));
    return String(actual ?? '').toLowerCase() === String(expected).toLowerCase();
  });
}

export async function queryRecords(
  collectionKey: string,
  opts: { where?: Where; sort?: { field: string; dir?: 'asc' | 'desc' }; limit?: number } = {},
) {
  const col = await getCollection(collectionKey);
  if (!col) return null;
  const rows = await db.dataRecord.findMany({ where: { collectionId: col.row.id }, orderBy: { updatedAt: 'desc' }, take: 2000 });
  let items = rows.filter((r) => matchesWhere(r.data as RecordData, opts.where));
  if (opts.sort) {
    const { field, dir = 'desc' } = opts.sort;
    items = items.sort((a, b) => {
      const av = (a.data as RecordData)[field];
      const bv = (b.data as RecordData)[field];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return dir === 'asc' ? cmp : -cmp;
    });
  }
  return { def: col.def, rows: items.slice(0, opts.limit ?? 500) };
}
