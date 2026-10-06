import { EFFORT_ORDER, type ConcreteEffort, type Effort, type TaskType } from './common';

/** Default effort per kind of work when the founder or Noor chose `auto`. */
export const EFFORT_BY_TASK: Record<TaskType, ConcreteEffort> = {
  general: 'medium',
  planning: 'medium',
  writing: 'medium',
  learning: 'medium',
  content: 'medium',
  research: 'medium',
  lead_research: 'high',
  analysis: 'medium',
  design: 'medium',
  coding: 'high',
};

export interface EffortContext {
  taskType: TaskType;
  /** 1 (trivial) … 3 (hard), as judged by Noor or the interpreter. */
  complexity?: 1 | 2 | 3;
  /** True when a mistake is costly (production, money, founder reputation). */
  risky?: boolean;
  /** Failed or incomplete attempts so far for this task. */
  previousFailures?: number;
}

const bump = (e: ConcreteEffort, by: number): ConcreteEffort =>
  EFFORT_ORDER[Math.max(0, Math.min(EFFORT_ORDER.length - 1, EFFORT_ORDER.indexOf(e) + by))];

/** Clamp to the closest level the provider actually supports. */
export function clampEffort(effort: ConcreteEffort, supported: readonly ConcreteEffort[]): ConcreteEffort {
  if (supported.includes(effort)) return effort;
  const want = EFFORT_ORDER.indexOf(effort);
  const sorted = [...supported].sort(
    (a, b) => Math.abs(EFFORT_ORDER.indexOf(a) - want) - Math.abs(EFFORT_ORDER.indexOf(b) - want),
  );
  return sorted[0] ?? 'medium';
}

/**
 * `auto` considers complexity, risk and previous failed attempts.
 * Explicit levels are respected (only clamped to what the provider supports).
 */
export function resolveEffort(
  requested: Effort | undefined,
  ctx: EffortContext,
  supported: readonly ConcreteEffort[] = EFFORT_ORDER,
): ConcreteEffort {
  if (requested && requested !== 'auto') return clampEffort(requested, supported);
  let effort = EFFORT_BY_TASK[ctx.taskType] ?? 'medium';
  if (ctx.complexity === 1) effort = bump(effort, -1);
  if (ctx.complexity === 3) effort = bump(effort, 1);
  if (ctx.risky) effort = bump(effort, 1);
  if ((ctx.previousFailures ?? 0) > 0) effort = bump(effort, 1);
  return clampEffort(effort, supported);
}

export const EFFORT_LABEL: Record<Effort, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  auto: 'Auto',
};
