import type { MessageRef } from '@opervio/contracts';
import { z } from 'zod';
import { bus } from '../bus';
import { db, Prisma } from '../db';

export type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

export const ok = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

export const fail = (err: unknown): ToolResult => ({
  content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
  isError: true,
});

export const handle =
  <A>(fn: (args: A) => Promise<unknown>) =>
  async (args: A): Promise<ToolResult> => {
    try {
      return ok(await fn(args));
    } catch (err) {
      return fail(err);
    }
  };

// Loose shapes for big nested specs: the full Zod grammar validates inside the handler and returns
// precise, AI-readable errors (cheaper than shipping the whole grammar as JSON Schema every turn).
export const LooseObject = z.record(z.string(), z.unknown());
export const LoosePage = z.object({
  title: z.string(),
  icon: z.string(),
  description: z.string().optional(),
  sections: z.array(LooseObject),
});
export const CollectionInput = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(
    z.object({ key: z.string(), label: z.string(), type: z.string(), options: z.array(z.string()).optional() }),
  ),
  titleField: z.string(),
  statusField: z.string().optional(),
  dateField: z.string().optional(),
});
export const TaskInput = z.object({
  title: z.string(),
  objective: z.string(),
  taskType: z.string(),
  deliverable: z.string(),
  successCriteria: z.array(z.string()),
  expectedOutputs: z.array(z.string()).optional(),
  effort: z.string().optional(),
  workdir: z.string().optional(),
});
export const AgentInput = z.object({
  name: z.string(),
  role: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  effort: z.string().optional(),
});

/** Attaches a card (page/agent/decision/output) to Noor's current chat message. */
export async function addMessageRef(messageId: string, ref: MessageRef) {
  const msg = await db.message.findUnique({ where: { id: messageId } });
  if (!msg) return;
  const refs = [...((msg.refs as unknown as MessageRef[]) ?? []), ref];
  await db.message.update({ where: { id: messageId }, data: { refs: refs as unknown as Prisma.InputJsonValue } });
  bus.invalidate('messages');
}
