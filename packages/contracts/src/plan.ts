import { z } from 'zod';
import { ArtifactType, Effort, FocusKind, ProviderId, Slug, TaskType } from './common';
import { PageSpec } from './page';
import { CollectionDef } from './records';

/** What a specialist is asked to achieve. Written by Noor; compiled into a real prompt per run. */
export const TaskSpec = z.strictObject({
  title: z.string().min(3).max(80),
  objective: z.string().min(10).max(2000),
  taskType: TaskType,
  deliverable: z.string().min(3).max(400),
  successCriteria: z.array(z.string().min(3).max(240)).min(1).max(8),
  expectedOutputs: z.array(ArtifactType).max(5).optional(),
  effort: Effort.optional(),
  workdir: z.string().max(400).optional(),
});
export type TaskSpec = z.infer<typeof TaskSpec>;

export const AgentSpec = z.strictObject({
  name: z.string().min(2).max(24),
  role: z.string().min(3).max(60),
  provider: z.union([ProviderId, z.literal('auto')]).optional(),
  model: z.string().max(60).optional(),
  effort: Effort.optional(),
});
export type AgentSpec = z.infer<typeof AgentSpec>;

export const RoutineSpec = z.strictObject({
  title: z.string().min(2).max(80),
  /** 5-field cron in the founder's timezone, e.g. "0 8 * * *" (08:00 daily). */
  schedule: z.string().min(9).max(60),
  kind: z.enum(['reminder', 'noor', 'task']),
  focus: Slug.optional(),
  message: z.string().max(400).optional(),
  agent: AgentSpec.optional(),
  task: TaskSpec.optional(),
});
export type RoutineSpec = z.infer<typeof RoutineSpec>;

export const TodaySpec = z.strictObject({
  title: z.string().min(2).max(120),
  focus: Slug.optional(),
  minutes: z.number().int().min(1).max(600).optional(),
});
export type TodaySpec = z.infer<typeof TodaySpec>;

export const FocusSpec = z.strictObject({
  key: Slug,
  name: z.string().min(1).max(40),
  kind: FocusKind,
  why: z.string().min(3).max(300),
  cadence: z.string().max(80).optional(),
  collections: z.array(CollectionDef).max(4).optional(),
  page: PageSpec.optional(),
});
export type FocusSpec = z.infer<typeof FocusSpec>;

/** Noor's proposal for how to organize the founder's world. Nothing is created until confirmed. */
export const PlanProposal = z
  .strictObject({
    summary: z.string().min(3).max(1200),
    focuses: z.array(FocusSpec).min(1).max(8),
    agents: z
      .array(AgentSpec.extend({ focus: Slug, task: TaskSpec }))
      .max(6)
      .optional(),
    today: z.array(TodaySpec).max(6).optional(),
    todayNote: z.string().max(200).optional(),
    routines: z.array(RoutineSpec).max(6).optional(),
    confirmMessage: z.string().min(2).max(800),
  })
  .superRefine((p, ctx) => {
    const keys = new Set(p.focuses.map((f) => f.key));
    p.agents?.forEach((a, i) => {
      if (!keys.has(a.focus)) ctx.addIssue({ code: 'custom', path: ['agents', i, 'focus'], message: `unknown focus "${a.focus}"` });
    });
    p.today?.forEach((t, i) => {
      if (t.focus && !keys.has(t.focus)) ctx.addIssue({ code: 'custom', path: ['today', i, 'focus'], message: `unknown focus "${t.focus}"` });
    });
  });
export type PlanProposal = z.infer<typeof PlanProposal>;
