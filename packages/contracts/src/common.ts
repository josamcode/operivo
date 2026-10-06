import { z } from 'zod';

export const ProviderId = z.enum(['claude', 'codex']);
export type ProviderId = z.infer<typeof ProviderId>;

/** Effort is a first-class, founder-visible setting. `auto` is resolved before every run. */
export const Effort = z.enum(['low', 'medium', 'high', 'xhigh', 'auto']);
export type Effort = z.infer<typeof Effort>;
export type ConcreteEffort = Exclude<Effort, 'auto'>;
export const EFFORT_ORDER: ConcreteEffort[] = ['low', 'medium', 'high', 'xhigh'];

export const TaskStatus = z.enum(['queued', 'running', 'waiting', 'done', 'failed', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const RunStatus = z.enum(['preparing', 'running', 'judging', 'done', 'failed', 'cancelled']);
export type RunStatus = z.infer<typeof RunStatus>;

export const AgentStatus = z.enum(['idle', 'working', 'waiting', 'done', 'failed', 'stopped']);
export type AgentStatus = z.infer<typeof AgentStatus>;

export const FocusKind = z.enum(['main', 'supporting', 'continuous', 'goal', 'idea', 'experiment']);
export type FocusKind = z.infer<typeof FocusKind>;

export const TaskType = z.enum([
  'research',
  'lead_research',
  'content',
  'writing',
  'coding',
  'analysis',
  'planning',
  'learning',
  'design',
  'general',
]);
export type TaskType = z.infer<typeof TaskType>;

export const ArtifactType = z.enum([
  'pdf',
  'xlsx',
  'csv',
  'pptx',
  'docx',
  'md',
  'image',
  'code',
  'json',
  'html',
  'txt',
  'diff',
  'other',
]);
export type ArtifactType = z.infer<typeof ArtifactType>;

export const MemoryKind = z.enum(['fact', 'preference', 'decision', 'context', 'note', 'approach']);
export type MemoryKind = z.infer<typeof MemoryKind>;

export const VerdictStatus = z.enum(['complete', 'incomplete', 'needs_founder', 'failed']);
export type VerdictStatus = z.infer<typeof VerdictStatus>;

export const Language = z.enum(['ar', 'en']);
export type Language = z.infer<typeof Language>;

export const Slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,47}$/, 'lowercase letters, digits and dashes only');

export const CollectionKey = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.-]{0,63}$/, 'lowercase key like "leads" or "content.scripts"');

export const FieldKey = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/, 'field keys are identifiers like "stage" or "company_name"');

export const MetricKey = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.-]{0,63}$/, 'metric keys look like "fitness.workouts"');

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'page';
