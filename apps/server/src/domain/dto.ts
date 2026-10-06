import type {
  AgentDTO,
  ArtifactDTO,
  ConcreteEffort,
  DecisionDTO,
  Effort,
  FocusDTO,
  FounderDTO,
  JudgeVerdict,
  MemoryDTO,
  MessageDTO,
  MessageRef,
  NotificationDTO,
  RoutineDTO,
  RunBriefDTO,
  RunEventDTO,
  RunProgress,
  TaskDTO,
} from '@opervio/contracts';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import type {
  Agent,
  Artifact,
  Decision,
  Focus,
  Founder,
  Memory,
  Message,
  Notification,
  Page,
  Routine,
  Run,
  RunEvent,
  Task,
} from '../generated/prisma/client';
import { iso } from '../lib/time';

type FocusWithPage = Focus & { page?: Pick<Page, 'slug' | 'icon'> | null };

export const founderDTO = (f: Founder): FounderDTO => ({
  id: f.id,
  name: f.name,
  language: f.language === 'ar' ? 'ar' : 'en',
  work: f.work,
  timeAvailable: f.timeAvailable,
  links: (f.links ?? {}) as FounderDTO['links'],
  commStyle: f.commStyle as FounderDTO['commStyle'],
  autonomy: f.autonomy as FounderDTO['autonomy'],
  alwaysAsk: f.alwaysAsk,
  timezone: f.timezone,
});

export const focusDTO = (f: FocusWithPage): FocusDTO => ({
  id: f.id,
  key: f.key,
  name: f.name,
  kind: f.kind as FocusDTO['kind'],
  why: f.why,
  cadence: f.cadence,
  status: f.status as FocusDTO['status'],
  pageSlug: f.page?.slug ?? null,
  icon: f.page?.icon ?? null,
});

export const runBriefDTO = (r: Run): RunBriefDTO => ({
  id: r.id,
  status: r.status as RunBriefDTO['status'],
  provider: r.provider as RunBriefDTO['provider'],
  model: r.model,
  effort: r.effort as ConcreteEffort,
  attempt: r.attempt,
  startedAt: r.startedAt.toISOString(),
  finishedAt: iso(r.finishedAt),
  progress: (r.progress as RunProgress | null) ?? null,
  lastActivity: r.lastActivity,
  costUsd: r.costUsd,
});

export const runEventDTO = (e: RunEvent): RunEventDTO => ({
  id: e.id,
  runId: e.runId,
  ts: e.ts.toISOString(),
  kind: e.kind as RunEventDTO['kind'],
  label: e.label,
  detail: e.detail ?? null,
});

export type AgentWithRelations = Agent & {
  focus?: FocusWithPage | null;
  tasks?: Task[];
  runs?: Run[];
  _count?: { artifacts: number };
};

export function agentDTO(a: AgentWithRelations, doneCount = 0): AgentDTO {
  const task = a.tasks?.[0] ?? null;
  const run = a.runs?.[0] ?? null;
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    provider: a.provider as AgentDTO['provider'],
    model: a.model,
    effort: a.effort as Effort,
    status: a.status as AgentDTO['status'],
    focus: a.focus ? { id: a.focus.id, name: a.focus.name, pageSlug: a.focus.page?.slug ?? null } : null,
    createdAt: a.createdAt.toISOString(),
    task: task ? { id: task.id, title: task.title, status: task.status as TaskDTO['status'] } : null,
    run: run ? runBriefDTO(run) : null,
    stats: { done: doneCount, outputs: a._count?.artifacts ?? 0 },
  };
}

export const taskDTO = (t: Task & { agent?: Agent | null; focus?: Focus | null }): TaskDTO => ({
  id: t.id,
  title: t.title,
  objective: t.objective,
  taskType: t.taskType as TaskDTO['taskType'],
  deliverable: t.deliverable,
  successCriteria: t.successCriteria,
  expectedOutputs: t.expectedOutputs as TaskDTO['expectedOutputs'],
  status: t.status as TaskDTO['status'],
  agent: t.agent ? { id: t.agent.id, name: t.agent.name, role: t.agent.role } : null,
  focus: t.focus ? { id: t.focus.id, name: t.focus.name } : null,
  attempts: t.attempts,
  summary: t.summary,
  verdict: (t.verdict as JudgeVerdict | null) ?? null,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

export const artifactDTO = (
  a: Artifact & { agent?: Agent | null; task?: Task | null; focus?: FocusWithPage | null },
): ArtifactDTO => ({
  id: a.id,
  title: a.title,
  type: a.type as ArtifactDTO['type'],
  path: a.path,
  fileName: basename(a.path),
  sizeBytes: a.sizeBytes,
  summary: a.summary,
  agent: a.agent ? { id: a.agent.id, name: a.agent.name } : null,
  task: a.task ? { id: a.task.id, title: a.task.title } : null,
  focus: a.focus ? { id: a.focus.id, name: a.focus.name, pageSlug: a.focus.page?.slug ?? null } : null,
  createdAt: a.createdAt.toISOString(),
  exists: existsSync(a.path),
});

export const decisionDTO = (d: Decision & { agent?: Agent | null; focus?: Focus | null }): DecisionDTO => ({
  id: d.id,
  kind: d.kind as DecisionDTO['kind'],
  title: d.title,
  recommendation: d.recommendation,
  why: d.why,
  options: (d.options ?? []) as unknown as DecisionDTO['options'],
  details: d.details,
  status: d.status as DecisionDTO['status'],
  choice: d.choice,
  note: d.note,
  payload: d.payload ?? null,
  agent: d.agent ? { id: d.agent.id, name: d.agent.name } : null,
  focus: d.focus ? { id: d.focus.id, name: d.focus.name } : null,
  createdAt: d.createdAt.toISOString(),
  resolvedAt: iso(d.resolvedAt),
});

export const memoryDTO = (m: Memory & { focus?: Focus | null }): MemoryDTO => ({
  id: m.id,
  kind: m.kind as MemoryDTO['kind'],
  content: m.content,
  source: m.source,
  scope: m.scope,
  focus: m.focus ? { id: m.focus.id, name: m.focus.name } : null,
  createdAt: m.createdAt.toISOString(),
});

export const messageDTO = (m: Message): MessageDTO => ({
  id: m.id,
  role: m.role as MessageDTO['role'],
  content: m.content,
  status: m.status as MessageDTO['status'],
  activity: m.activity,
  refs: (m.refs ?? []) as unknown as MessageRef[],
  createdAt: m.createdAt.toISOString(),
});

export const notificationDTO = (n: Notification): NotificationDTO => ({
  id: n.id,
  kind: n.kind as NotificationDTO['kind'],
  title: n.title,
  body: n.body,
  link: n.link,
  readAt: iso(n.readAt),
  createdAt: n.createdAt.toISOString(),
});

export const routineDTO = (r: Routine & { focus?: Focus | null }): RoutineDTO => ({
  id: r.id,
  title: r.title,
  schedule: r.schedule,
  kind: r.kind as RoutineDTO['kind'],
  enabled: r.enabled,
  lastRunAt: iso(r.lastRunAt),
  nextRunAt: iso(r.nextRunAt),
  focus: r.focus ? { id: r.focus.id, name: r.focus.name } : null,
});
