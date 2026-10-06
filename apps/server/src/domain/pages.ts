import {
  applyPageOps,
  CollectionDef,
  collectionsUsed,
  formatZodError,
  PageOp,
  PageSpec,
  slugify,
  withSectionIds,
  type NavItemDTO,
  type PageDTO,
} from '@opervio/contracts';
import { z } from 'zod';
import { bus } from '../bus';
import { db } from '../db';
import { focusDTO } from './dto';

export class ValidationError extends Error {}

export function parsePageSpec(input: unknown): PageSpec {
  const parsed = PageSpec.safeParse(input);
  if (!parsed.success) throw new ValidationError(formatZodError(parsed.error, 'page'));
  return withSectionIds(parsed.data);
}

async function uniqueSlug(title: string, excludeId?: string) {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; ; n++) {
    const hit = await db.page.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${n}`;
  }
}

/** Missing collections are not an error (agents may create them later) but the AI should know. */
async function warnings(spec: PageSpec): Promise<string[]> {
  const used = collectionsUsed(spec);
  if (!used.length) return [];
  const existing = await db.collection.findMany({ where: { key: { in: used } }, select: { key: true } });
  const missing = used.filter((k) => !existing.some((e) => e.key === k));
  return missing.length
    ? [`Collections not defined yet: ${missing.join(', ')}. Define them (define_collection) or the sections will show an empty state.`]
    : [];
}

export async function createPage(input: { spec: unknown; focusId?: string | null; createdBy?: string }) {
  const spec = parsePageSpec(input.spec);
  if (input.focusId) {
    const existing = await db.page.findUnique({ where: { focusId: input.focusId } });
    if (existing) throw new ValidationError(`This focus already has a page ("${existing.slug}"). Use update_page instead.`);
  }
  const order = ((await db.page.aggregate({ _max: { order: true } }))._max.order ?? 0) + 1;
  const page = await db.page.create({
    data: {
      slug: await uniqueSlug(spec.title),
      title: spec.title,
      icon: spec.icon,
      description: spec.description ?? null,
      spec,
      order,
      focusId: input.focusId ?? null,
      createdBy: input.createdBy ?? 'noor',
    },
  });
  bus.invalidate('nav', 'pages', 'home', 'bootstrap');
  return { page, warnings: await warnings(spec) };
}

export async function updatePage(slugOrId: string, opsInput: unknown) {
  const page = await db.page.findFirst({ where: { OR: [{ slug: slugOrId }, { id: slugOrId }] } });
  if (!page) throw new ValidationError(`No page "${slugOrId}"`);
  const ops = z.array(PageOp).min(1).max(30).safeParse(opsInput);
  if (!ops.success) throw new ValidationError(formatZodError(ops.error, 'page operations'));
  let spec: PageSpec;
  try {
    spec = applyPageOps(PageSpec.parse(page.spec), ops.data);
  } catch (err) {
    throw new ValidationError((err as Error).message);
  }
  const updated = await db.page.update({
    where: { id: page.id },
    data: {
      spec,
      title: spec.title,
      icon: spec.icon,
      description: spec.description ?? null,
      slug: spec.title !== page.title ? await uniqueSlug(spec.title, page.id) : page.slug,
    },
  });
  bus.invalidate('nav', `page:${page.slug}`, `page:${updated.slug}`, 'pages', 'home');
  return { page: updated, warnings: await warnings(spec) };
}

export async function listNav(): Promise<NavItemDTO[]> {
  const pages = await db.page.findMany({
    orderBy: { order: 'asc' },
    include: { focus: { include: { agents: { where: { status: 'working' }, select: { id: true } } } } },
  });
  return pages.map((p) => ({
    slug: p.slug,
    title: p.title,
    icon: p.icon,
    focusKind: (p.focus?.kind as NavItemDTO['focusKind']) ?? null,
    activeAgents: p.focus?.agents.length ?? 0,
  }));
}

export async function getPageDTO(slug: string): Promise<PageDTO | null> {
  const page = await db.page.findUnique({ where: { slug }, include: { focus: { include: { page: true } } } });
  if (!page) return null;
  const spec = PageSpec.parse(page.spec);
  const keys = collectionsUsed(spec);
  const collections = await db.collection.findMany({
    where: { OR: [{ key: { in: keys } }, ...(page.focusId ? [{ focusId: page.focusId }] : [])] },
  });
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    icon: page.icon,
    description: page.description,
    focus: page.focus ? focusDTO(page.focus) : null,
    spec,
    collections: collections.map((c) => CollectionDef.parse(c.def)),
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function reorderPages(slugs: string[]) {
  await db.$transaction(slugs.map((slug, i) => db.page.update({ where: { slug }, data: { order: i + 1 } })));
  bus.invalidate('nav');
}
