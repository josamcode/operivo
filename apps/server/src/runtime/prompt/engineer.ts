import { EngineeredInstructions, type CompiledPrompt, type RoleDefaults } from '@opervio/contracts';
import { z } from 'zod';
import { completeJson } from '../../providers/registry';
import { clip } from '../../lib/text';

type Skeleton = Omit<CompiledPrompt, 'text' | 'systemText'>;

/** What the model is asked for: no length limits (those cause slow validation retries); clipped after. */
const Loose = z.object({
  scope: z.string(),
  approach: z.array(z.string()),
  successCriteria: z.array(z.string()),
  deliverables: z.array(z.string()),
  constraints: z.array(z.string()),
  stopConditions: z.array(z.string()),
  relevantTools: z.array(z.string()),
  avoid: z.array(z.string()),
});

const SYSTEM = `You are Opervio's Prompt Engineer. You improve the instructions an autonomous AI agent will receive.

You do NOT perform the task. Do not research it, answer it, or include results, names, facts or data you invent.

Improve:
- scope: one tight paragraph — what exactly is in and out of scope
- approach: high-level steps only; the agent is strong and reasons for itself, do not micromanage
- successCriteria: verifiable checks a judge can confirm from the outputs (keep every original criterion's intent)
- deliverables: exact, useful outputs (file type, structure, what each must contain)
- constraints: task-specific prohibitions (global safety rules already exist; do not repeat them)
- stopConditions: when to stop, when to switch approach, when to escalate
- relevantTools: ids from the available tools list, most useful first
- avoid: what NOT to waste time on for this task

Every line must change the agent's behavior. Be concise. Keep the founder's language for founder-facing deliverables.`;

export async function engineerPrompt(skeleton: Skeleton, meta: { title: string; taskType: string; complexity: number; attempt: number }, defaults: RoleDefaults) {
  const input = {
    task: meta.title,
    taskType: meta.taskType,
    complexity: meta.complexity,
    attempt: meta.attempt,
    role: skeleton.role,
    objective: skeleton.objective,
    why: skeleton.why,
    context: skeleton.context.map((c) => ({ label: c.label, content: clip(c.content, 900) })),
    availableTools: skeleton.tools.map((t) => t.id),
    draftInstructions: skeleton.instructions,
    draftDeliverables: skeleton.deliverables,
    draftSuccessCriteria: skeleton.successCriteria,
  };
  const res = await completeJson({
    defaults,
    system: SYSTEM,
    prompt: `Improve the instructions for this agent task. Return JSON only.\n\n${JSON.stringify(input, null, 2)}`,
    schema: Loose,
    timeoutMs: 120_000,
  });
  if (!res) return null;
  // Clip into the strict contract instead of making the model retry against length limits.
  const list = (v: string[], items: number, n: number) => v.filter(Boolean).slice(0, items).map((x) => clip(x, n));
  const criteria = list(res.data.successCriteria, 10, 300);
  const deliverables = list(res.data.deliverables, 8, 300);
  const data = EngineeredInstructions.parse({
    scope: clip(res.data.scope, 1200),
    approach: list(res.data.approach, 8, 400),
    successCriteria: criteria.length ? criteria : skeleton.successCriteria.slice(0, 1),
    deliverables: deliverables.length ? deliverables : skeleton.deliverables.slice(0, 1),
    constraints: list(res.data.constraints, 10, 300),
    stopConditions: list(res.data.stopConditions, 6, 300),
    relevantTools: list(res.data.relevantTools, 10, 80),
    avoid: list(res.data.avoid, 8, 300),
  });
  return { ...res, data };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const merge = (...lists: string[][]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lists.flat()) {
    const k = norm(l);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(l);
    }
  }
  return out;
};

/**
 * Merges engineered instructions into the skeleton. Noor's original success criteria are the
 * contract the Result Judge enforces, so they are always kept; the engineer can only add to them.
 */
export function mergeEngineered(skeleton: Skeleton, eng: EngineeredInstructions, originalCriteria: string[]): Skeleton {
  const toolOrder = new Map(eng.relevantTools.map((t, i) => [t, i]));
  return {
    ...skeleton,
    instructions: merge([eng.scope], eng.approach, skeleton.instructions),
    deliverables: eng.deliverables.length ? merge(eng.deliverables, skeleton.deliverables.slice(1)) : skeleton.deliverables,
    successCriteria: merge(originalCriteria, eng.successCriteria, skeleton.successCriteria),
    constraints: merge(skeleton.constraints, eng.constraints),
    stopConditions: merge(eng.stopConditions, skeleton.stopConditions),
    avoid: eng.avoid,
    tools: [...skeleton.tools].sort((a, b) => (toolOrder.get(a.id) ?? 99) - (toolOrder.get(b.id) ?? 99)),
    engineered: true,
  };
}
