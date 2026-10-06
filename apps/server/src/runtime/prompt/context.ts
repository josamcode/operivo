import { CollectionDef, type ContextItem } from '@opervio/contracts';
import fs from 'fs-extra';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { db } from '../../db';
import { searchMemory } from '../../domain/memory';
import type { Agent, Focus, Founder, Task } from '../../generated/prisma/client';
import { redact } from '../../lib/redact';
import { clip } from '../../lib/text';
import { localTime } from '../../lib/time';
import type { Interpretation } from './interpret';

export interface ContextInput {
  task: Task;
  agent: Agent;
  focus: Focus | null;
  founder: Founder;
  workdir: string;
  interp: Interpretation;
}

const LANG = { ar: 'Arabic (Egyptian, natural)', en: 'English' } as const;

/**
 * Context Retriever: selects only what is relevant for this task — never the whole database.
 * Every item carries the reason it was selected, so the founder can see why the agent knew it.
 */
export async function retrieveContext({ task, focus, founder, workdir, interp }: ContextInput): Promise<ContextItem[]> {
  const items: ContextItem[] = [];
  const links = founder.links as Record<string, string | undefined>;
  const linkLines = Object.entries(links ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);

  items.push({
    source: 'founder',
    label: 'Founder',
    reason: 'Who the work is for',
    content: [
      `Name: ${founder.name}`,
      `Does: ${clip(founder.work, 400)}`,
      `Language for founder-facing text: ${LANG[founder.language as 'ar' | 'en'] ?? founder.language}`,
      `Realistic available time: ${clip(founder.timeAvailable, 160)}`,
      `Local time now: ${localTime(founder.timezone)} (${founder.timezone})`,
      ...(['research', 'lead_research', 'content', 'writing', 'design'].includes(interp.taskType) && linkLines.length ? [`Public links: ${linkLines.join(' · ')}`] : []),
    ].join('\n'),
  });

  if (focus) {
    items.push({
      source: 'focus',
      label: `Focus: ${focus.name}`,
      reason: 'The area this task serves',
      content: [`Kind: ${focus.kind}`, `Why it matters now: ${focus.why}`, focus.cadence ? `Cadence: ${focus.cadence}` : ''].filter(Boolean).join('\n'),
    });
  }

  // Relevant memories (facts, preferences, decisions, notes) — ranked by full-text + trigram.
  const memories = await searchMemory(interp.searchText, { focusId: focus?.id, kinds: ['fact', 'preference', 'decision', 'context', 'note'], limit: 6 });
  const prefs = await db.memory.findMany({ where: { kind: 'preference', focusId: null }, orderBy: { updatedAt: 'desc' }, take: 3 });
  type Mem = { id: string; kind: string; content: string; createdAt: Date };
  const merged = new Map<string, Mem>();
  for (const m of [...prefs, ...memories] as Mem[]) merged.set(m.id, m);
  const memLines = [...merged.values()]
    .slice(0, 8)
    .map((m) => `- [${m.kind}] ${clip(m.content, 300)} (saved ${new Date(m.createdAt).toISOString().slice(0, 10)})`);
  if (memLines.length) {
    items.push({ source: 'memory', label: 'Relevant memory', reason: 'Matched this task by search; dates show freshness', content: memLines.join('\n') });
  }

  // Only approaches from the same kind of work are useful precedent.
  const approaches = (await searchMemory(`${interp.taskType} ${interp.searchText}`, { kinds: ['approach'], limit: 6 }))
    .filter((a) => a.content.startsWith(`${interp.taskType} `))
    .slice(0, 2);
  if (approaches.length) {
    items.push({
      source: 'approach',
      label: 'Approaches that worked before',
      reason: 'Previous successful approach for similar work',
      content: approaches.map((a) => `- ${clip(a.content, 400)}`).join('\n'),
    });
  }

  // Previous outputs in this focus: avoid duplicates, build on existing work, verify freshness.
  const outputs = await db.artifact.findMany({ where: focus ? { focusId: focus.id } : { taskId: task.id }, orderBy: { createdAt: 'desc' }, take: 6 });
  if (outputs.length) {
    items.push({
      source: 'output',
      label: 'Existing outputs',
      reason: 'Earlier deliverables in this area — build on them, do not duplicate',
      content: outputs.map((o) => `- ${o.title} (${o.type}, ${o.createdAt.toISOString().slice(0, 10)}): ${o.path}${o.summary ? ` — ${clip(o.summary, 160)}` : ''}`).join('\n'),
    });
  }

  // Structured records already collected in this focus (e.g. existing leads) — prevents duplicate work.
  const collections = focus ? await db.collection.findMany({ where: { focusId: focus.id }, include: { _count: { select: { records: true } } } }) : [];
  for (const c of collections.slice(0, 3)) {
    const def = CollectionDef.parse(c.def);
    const recent = await db.dataRecord.findMany({ where: { collectionId: c.id }, orderBy: { updatedAt: 'desc' }, take: 30 });
    const titles = recent.map((r) => String((r.data as Record<string, unknown>)[def.titleField] ?? '')).filter(Boolean);
    items.push({
      source: 'record',
      label: `Collection "${def.key}" (${c._count.records} records)`,
      reason: 'Existing structured data — update it instead of starting over',
      content: [
        `Fields: ${def.fields.map((f) => `${f.key}:${f.type}${f.options ? `(${f.options.join('|')})` : ''}`).join(', ')}`,
        titles.length ? `Existing ${def.titleField} values: ${titles.join('; ')}` : 'No records yet.',
      ].join('\n'),
    });
  }

  // Coding: real current project state (freshness rule) — branch, uncommitted work, recent commits.
  if (interp.needs.code && (await fs.pathExists(join(workdir, '.git')))) {
    try {
      const git = simpleGit(workdir);
      const [status, logRes] = await Promise.all([git.status(), git.log({ maxCount: 5 })]);
      const dirty = status.files.slice(0, 20).map((f) => `${f.working_dir}${f.index} ${f.path}`);
      items.push({
        source: 'project',
        label: 'Project state',
        reason: 'Current repository state — inspect before editing, never destroy unrelated work',
        content: [
          `Path: ${workdir}`,
          `Branch: ${status.current}${status.tracking ? ` (tracking ${status.tracking})` : ''}`,
          dirty.length ? `Uncommitted changes (${status.files.length}):\n${dirty.join('\n')}` : 'Working tree clean.',
          `Recent commits:\n${logRes.all.map((c) => `${c.hash.slice(0, 7)} ${clip(c.message, 80)}`).join('\n')}`,
        ].join('\n'),
      });
    } catch {
      /* not a usable repo */
    }
  }

  // Earlier attempts on this same task: the judge's feedback and founder answers.
  const previous = await db.run.findMany({ where: { taskId: task.id }, orderBy: { startedAt: 'desc' }, take: 3 });
  const prevLines = previous
    .map((r) => r.verdict as { status?: string; summary?: string; missing?: string[] } | null)
    .filter((v): v is NonNullable<typeof v> => Boolean(v?.status && v.status !== 'complete'))
    .map((v) => `- Previous attempt judged ${v.status}: ${clip(v.summary, 240)}${v.missing?.length ? ` Missing: ${v.missing.join('; ')}` : ''}`);
  if (prevLines.length) {
    items.push({ source: 'task', label: 'Previous attempts', reason: 'Do not repeat what failed', content: prevLines.join('\n') });
  }

  return items.map((i) => ({ ...i, content: redact(i.content) }));
}
