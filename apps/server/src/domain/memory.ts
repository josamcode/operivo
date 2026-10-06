import type { MemoryKind } from '@opervio/contracts';
import { bus } from '../bus';
import { db, Prisma } from '../db';
import { redact } from '../lib/redact';

const STOP = new Set(
  'the a an and or of to in on for with from by at is are was were be been it this that these those you your our we i me my as into about over not no yes can will should would could do does did have has had more most very just also than then them they their there here what which who whom when where why how all any each other some such only own same so too out up down off again further once عن في من على الى إلى مع هو هي ده دي اللي انا أنا احنا إحنا يا و او أو لا مش ما كان كانت هذا هذه ذلك التي الذي'.split(
    ' ',
  ),
);

/** Significant words → an OR tsquery so a long objective still finds relevant memories. */
export function toOrQuery(text: string, max = 24): string | null {
  const words = [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w)))].slice(0, max);
  return words.length ? words.map((w) => `${w.replace(/'/g, '')}:*`).join(' | ') : null;
}

export async function remember(input: { kind: MemoryKind; content: string; source: string; focusId?: string | null }) {
  const content = redact(input.content.trim()).slice(0, 2000);
  if (content.length < 3) throw new Error('Memory content is empty');
  // Near-duplicates update the existing memory instead of piling up.
  const dupes = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Memory" WHERE kind = ${input.kind} AND similarity(content, ${content}) > 0.75 LIMIT 1`;
  const scope = input.focusId ? `focus:${input.focusId}` : 'global';
  const memory = dupes[0]
    ? await db.memory.update({ where: { id: dupes[0].id }, data: { content, source: input.source } })
    : await db.memory.create({ data: { kind: input.kind, content, source: input.source, scope, focusId: input.focusId ?? null } });
  bus.invalidate('memories');
  return { memory, updated: Boolean(dupes[0]) };
}

export interface MemoryHit {
  id: string;
  kind: string;
  content: string;
  source: string;
  focusId: string | null;
  createdAt: Date;
  score: number;
}

/** Postgres full-text (OR of significant words) + trigram similarity. No vector DB. */
export async function searchMemory(query: string, opts: { focusId?: string | null; kinds?: MemoryKind[]; limit?: number } = {}) {
  const tsq = toOrQuery(query);
  const limit = opts.limit ?? 8;
  const kinds = opts.kinds?.length ? opts.kinds : null;
  if (!tsq) return [];
  const focusFilter = opts.focusId ? Prisma.sql`AND ("focusId" IS NULL OR "focusId" = ${opts.focusId})` : Prisma.empty;
  const kindFilter = kinds ? Prisma.sql`AND kind = ANY(${kinds})` : Prisma.empty;
  return db.$queryRaw<MemoryHit[]>`
    SELECT id, kind, content, source, "focusId", "createdAt",
      (ts_rank(to_tsvector('simple', content), to_tsquery('simple', ${tsq})) * 2
        + similarity(content, ${query.slice(0, 300)})
        + CASE WHEN "focusId" IS NOT NULL THEN 0.05 ELSE 0 END) AS score
    FROM "Memory"
    WHERE (to_tsvector('simple', content) @@ to_tsquery('simple', ${tsq}) OR similarity(content, ${query.slice(0, 300)}) > 0.2)
      ${focusFilter} ${kindFilter}
    ORDER BY score DESC, "createdAt" DESC
    LIMIT ${limit}`;
}
