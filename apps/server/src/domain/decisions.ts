import { formatZodError, PlanProposal, type DecisionOption } from '@opervio/contracts';
import { z } from 'zod';
import { bus } from '../bus';
import { db, Prisma } from '../db';
import { clip } from '../lib/text';
import { noorSystemTurn } from '../noor/turn';
import { notify } from './notify';
import { ValidationError } from './pages';
import { applyPlan } from './plan';
import { focusByKeyOrId, resumeTask } from './work';

const OptionInput = z.object({ id: z.string().min(1).max(40).optional(), label: z.string().min(1).max(80), description: z.string().max(200).optional() });

const normalizeOptions = (opts: z.infer<typeof OptionInput>[]): DecisionOption[] =>
  opts.map((o, i) => ({ id: o.id ?? `option-${i + 1}`, label: o.label, ...(o.description ? { description: o.description } : {}) }));

export async function proposePlan(input: unknown) {
  const parsed = PlanProposal.safeParse(input);
  if (!parsed.success) throw new ValidationError(formatZodError(parsed.error, 'plan'));
  // One open plan at a time: a newer proposal replaces the old one.
  await db.decision.updateMany({ where: { kind: 'plan', status: 'open' }, data: { status: 'dismissed', resolvedAt: new Date() } });
  const decision = await db.decision.create({
    data: {
      kind: 'plan',
      title: 'Confirm your setup',
      recommendation: clip(parsed.data.summary, 600),
      options: [
        { id: 'confirm', label: 'Confirm' },
        { id: 'adjust', label: 'Adjust' },
      ],
      payload: parsed.data as unknown as Prisma.InputJsonValue,
    },
  });
  bus.invalidate('decisions', 'home');
  return decision;
}

export async function createDecision(input: {
  kind: 'approval' | 'question';
  title: string;
  recommendation?: string | null;
  why?: string | null;
  options?: z.infer<typeof OptionInput>[];
  details?: string | null;
  payload?: unknown;
  agentId?: string | null;
  taskId?: string | null;
  focus?: string | null;
}) {
  const options = normalizeOptions(
    input.options?.length
      ? z.array(OptionInput).max(5).parse(input.options)
      : input.kind === 'approval'
        ? [
            { id: 'approve', label: 'Approve' },
            { id: 'decline', label: 'Decline' },
          ]
        : [],
  );
  const focus = await focusByKeyOrId(input.focus);
  const decision = await db.decision.create({
    data: {
      kind: input.kind,
      title: clip(input.title, 160),
      recommendation: input.recommendation ? clip(input.recommendation, 400) : null,
      why: input.why ? clip(input.why, 300) : null,
      options: options as unknown as Prisma.InputJsonValue,
      details: input.details ? clip(input.details, 4000) : null,
      payload: (input.payload ?? Prisma.DbNull) as Prisma.InputJsonValue,
      agentId: input.agentId ?? null,
      taskId: input.taskId ?? null,
      focusId: focus?.id ?? null,
    },
  });
  await notify('decision', decision.title, decision.recommendation, `/decisions/${decision.id}`);
  bus.invalidate('decisions', 'home');
  return decision;
}

/** The founder answers. Plans get applied; agent questions/approvals resume the waiting task. */
export async function resolveDecision(id: string, choice: string, note?: string | null) {
  const decision = await db.decision.findUnique({ where: { id }, include: { agent: true } });
  if (!decision) throw new ValidationError('Decision not found');
  if (decision.status !== 'open') throw new ValidationError('This decision was already handled');
  const options = (decision.options ?? []) as unknown as DecisionOption[];
  const label = options.find((o) => o.id === choice)?.label ?? choice;
  await db.decision.update({ where: { id }, data: { status: 'resolved', choice, note: note ?? null, resolvedAt: new Date() } });
  bus.invalidate('decisions', 'home');

  if (decision.kind === 'plan') {
    if (choice === 'confirm') {
      await applyPlan(PlanProposal.parse(decision.payload));
    } else {
      void noorSystemTurn(`The founder wants to adjust the proposed setup.${note ? ` Their note: "${note}"` : ''} Ask briefly what to change, or propose a revised plan if the note is clear.`, { visibleText: note || 'I want to adjust the plan.' });
    }
    return;
  }

  const answer = `${label}${note ? ` — ${note}` : ''}`;
  if (decision.taskId) {
    const payload = (decision.payload ?? {}) as { command?: string; action?: string };
    const followUp =
      decision.kind === 'approval'
        ? choice === 'approve'
          ? `The founder APPROVED: "${payload.action ?? decision.title}". You may now perform exactly that action${payload.command ? ` (command: ${payload.command})` : ''}, then finish the task.`
          : `The founder DECLINED: "${payload.action ?? decision.title}". Do not perform it. Finish the rest of the task and offer alternatives in your summary.${note ? ` Founder note: ${note}` : ''}`
        : `The founder answered your question "${decision.title}": ${answer}. Continue the task.`;
    await resumeTask(decision.taskId, followUp);
  } else {
    void noorSystemTurn(`The founder answered the decision "${decision.title}": ${answer}. Act on it.`, { visibleText: answer });
  }
}

/** Approved-actions allowlist for the policy hook: lets an approved command through once. */
export async function isApproved(taskId: string, command: string) {
  const approved = await db.decision.findMany({ where: { taskId, kind: 'approval', status: 'resolved', choice: 'approve' } });
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  return approved.some((d) => {
    const c = (d.payload as { command?: string } | null)?.command;
    return c ? norm(command).includes(norm(c)) : false;
  });
}
