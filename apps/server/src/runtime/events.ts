import type { RunEventKind, RunProgress } from '@opervio/contracts';
import { bus } from '../bus';
import { db, Prisma } from '../db';
import { redact, redactDeep } from '../lib/redact';
import { runEventDTO } from '../domain/dto';

/** Per-run live state that MCP tools contribute to (records written, last progress). */
export const runState = new Map<string, { records: Map<string, { created: number; updated: number }>; progress: string[] }>();

export function stateFor(runId: string) {
  let s = runState.get(runId);
  if (!s) {
    s = { records: new Map(), progress: [] };
    runState.set(runId, s);
  }
  return s;
}

/** Meaningful activity only — never raw logs or reasoning. */
export async function runEvent(runId: string, agentId: string, kind: RunEventKind, label: string, detail?: unknown) {
  const ev = await db.runEvent.create({
    data: { runId, kind, label: redact(label).slice(0, 200), detail: detail === undefined ? Prisma.DbNull : (redactDeep(detail) as Prisma.InputJsonValue) },
  });
  if (kind !== 'text') {
    await db.run.update({ where: { id: runId }, data: { lastActivity: ev.label } }).catch(() => {});
  }
  bus.emitEvent({ type: 'run.event', runId, agentId, event: runEventDTO(ev) });
  bus.invalidate('agents', `agent:${agentId}`, `run:${runId}`, 'home');
  return ev;
}

export async function setProgress(runId: string, agentId: string, progress: RunProgress) {
  await db.run.update({ where: { id: runId }, data: { progress: progress as unknown as Prisma.InputJsonValue } });
  stateFor(runId).progress.push(progress.total ? `${progress.label} (${progress.current ?? 0}/${progress.total})` : progress.label);
  await runEvent(runId, agentId, 'progress', progress.total ? `${progress.label} · ${progress.current ?? 0}/${progress.total}` : progress.label, progress);
}
