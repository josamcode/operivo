import { z } from 'zod';
import { VerdictStatus } from './common';

/** One piece of context the retriever selected, with the reason it was selected. */
export const ContextItem = z.object({
  source: z.enum(['founder', 'focus', 'memory', 'output', 'record', 'approach', 'project', 'task', 'decision']),
  label: z.string(),
  content: z.string(),
  reason: z.string(),
});
export type ContextItem = z.infer<typeof ContextItem>;

export const ToolInfo = z.object({
  id: z.string(),
  label: z.string(),
  usage: z.string(),
});
export type ToolInfo = z.infer<typeof ToolInfo>;

/** Output of the low-effort Prompt Engineer call. It improves instructions; it never solves the task. */
export const EngineeredInstructions = z.object({
  scope: z.string().max(1200),
  approach: z.array(z.string().max(400)).max(8),
  successCriteria: z.array(z.string().max(300)).min(1).max(10),
  deliverables: z.array(z.string().max(300)).min(1).max(8),
  constraints: z.array(z.string().max(300)).max(10),
  stopConditions: z.array(z.string().max(300)).max(6),
  relevantTools: z.array(z.string().max(80)).max(10),
  avoid: z.array(z.string().max(300)).max(8),
});
export type EngineeredInstructions = z.infer<typeof EngineeredInstructions>;

/** The structured prompt every specialist run receives — fully inspectable by the founder. */
export const CompiledPrompt = z.object({
  role: z.string(),
  objective: z.string(),
  why: z.string(),
  context: z.array(ContextItem),
  tools: z.array(ToolInfo),
  instructions: z.array(z.string()),
  deliverables: z.array(z.string()),
  successCriteria: z.array(z.string()),
  constraints: z.array(z.string()),
  stopConditions: z.array(z.string()),
  avoid: z.array(z.string()),
  engineered: z.boolean(),
  engineerNote: z.string().optional(),
  text: z.string(),
  systemText: z.string(),
});
export type CompiledPrompt = z.infer<typeof CompiledPrompt>;

export const JudgeVerdict = z.object({
  status: VerdictStatus,
  summary: z.string().max(600),
  missing: z.array(z.string().max(300)).max(8),
  feedback: z.string().max(1500).optional(),
  founderQuestion: z.string().max(400).optional(),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdict>;
